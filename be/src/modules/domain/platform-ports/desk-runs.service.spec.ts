import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import { AccountDataReadService } from "@modules/domain/account-data"
import { AgentGraphRawRowsService } from "@modules/domain/agent-graphs/agent-graph-raw-rows.service"
import { AgentRunRecordsService, type RunListFilter } from "@modules/domain/agent-runs"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionBindingsReadService, type ConnectionRecord } from "@modules/domain/connections"
import { triggerDeclarations } from "@modules/domain/provider-triggers/trigger-declarations.registry"
import { ZALO_TRIGGERS } from "@modules/domain/zalo-provider/zalo-message.trigger"
import { EntityEngineService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { ToolCallLogService } from "@modules/domain/tool-call-log"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import { runRowOf } from "@tests/fixtures/builders/agent-runs.builder"
import { ZALO_TEXT_EVENT } from "@tests/fixtures/builders/zalo-inbox.builder"
import { DeskRunsService } from "./desk-runs.service"

const tx = mock<ScopedTx>({ workspaceId: "ws-1" })

// The Zalo provider registers its REAL declaration at boot (`ZaloProviderModule`); the pipeline reader finds it by the run's `declaration`.
triggerDeclarations.register(...ZALO_TRIGGERS)

/**
 * The context of a run a customer line started on the one pipeline, member for member as `ProviderTriggersService.deliver` writes its
 * wake (`contextOf`: verb, event id, declaration, workflow, account, person, route, the raw row's type and id) and the flow keeps on the
 * run (`threadScope`). Ruling R52: the desk read the pre-pipeline `messageId`, which no such run carries, and showed no question.
 */
const deliveredOf = (rawRowId: string): Readonly<Record<string, string>> => ({
    verb: TRIGGER.zaloMessageReceived,
    eventId: `zalo_oa:${rawRowId}`,
    declaration: "zalo_oa:message.received",
    workflowId: "wf-front",
    connectionId: "conn-1",
    contactId: "contact-1",
    conversationId: "route-1",
    rawType: "zalo_oa.event",
    rawRowId,
    threadScope: "conversation:route-1",
})

const ROWS = new Map([
    ["run-1", runRowOf({ status: "done", context: deliveredOf("row-0") }, "run-1")],
    [
        "run-2",
        runRowOf({ status: "done", context: { text: "Record the new email of Phong", authorUserId: "u-1" } }, "run-2"),
    ],
    ["run-3", runRowOf({ status: "running", context: { authorAgentId: "agent-9" } }, "run-3")],
    [
        "run-4",
        runRowOf({ status: "done", context: deliveredOf("row-1") }, "run-4"),
    ],
    ["run-other", runRowOf({ agentId: "agent-2", status: "done", context: {} }, "run-other")],
])

/**
 * The `zalo_oa.event` row the webhook kept, as the account store returns it by id: the Zalo body untouched under `raw` (the declaration's
 * raw schema), with its connection and the moment it entered.
 */
const messageRowOf = (type: string, id: string, text: string): NonNullable<Awaited<ReturnType<AccountDataReadService["byId"]>>> => ({
    id,
    type,
    typeVersion: 1,
    key: id,
    value: { eventId: id, event: "user_send_text", raw: { ...ZALO_TEXT_EVENT, message: { msg_id: id, text } } },
    occurredAt: new Date("2026-11-14T01:00:00.000Z"),
    processedAt: null,
    connectionId: "conn-1",
    createdAt: "2026-11-14T01:00:00.000000Z",
})

const build = async () => {
    const engine = mock<EntityEngineService>()
    engine.scoped.mockImplementation((_workspaceId, work) => work(tx))
    const runs = mock<AgentRunRecordsService>()
    runs.runRows.mockImplementation((_tx, filter: RunListFilter) =>
        Promise.resolve(
            [...ROWS.values()].filter(
                (row) => (filter.ids?.includes(row.id) ?? true) && (filter.agentId === undefined || row.agentId === filter.agentId),
            ),
        ),
    )
    runs.runCounts.mockResolvedValue([{ agentId: "agent-1", status: "done", count: 7 }])
    const agents = mock<AgentDirectoryService>()
    agents.cardsOf.mockResolvedValue([{ id: "agent-9", name: "Front desk", module: "chatbot" }])
    const members = mock<WorkspaceMembersReadService>()
    members.namesOf.mockResolvedValue([{ userId: "u-1", displayName: "Anh Tu" }])
    const callLog = mock<ToolCallLogService>()
    callLog.recordsOfRuns.mockResolvedValue([
        { runId: "run-1", read: 4, changed: null, uncounted: 0 },
        { runId: "run-2", read: null, changed: 1, uncounted: 1 },
    ])
    callLog.recordsOfAgent.mockResolvedValue({ runId: null, read: 41, changed: 1, uncounted: 2 })
    const rows = mock<AccountDataReadService>({
        byId: jest.fn((type: string, id: string) =>
            Promise.resolve(
                id === "row-0"
                    ? messageRowOf(type, id, "Minh An has which services expiring?")
                    : id === "row-1"
                      ? messageRowOf(type, id, "Shop oi con do khong a?")
                      : null,
            ),
        ),
    })
    const connections = mock<ConnectionBindingsReadService>()
    connections.recordOf.mockResolvedValue(mock<ConnectionRecord>({ id: "conn-1" }))
    const moduleRef = await Test.createTestingModule({
        providers: [
            DeskRunsService,
            // The REAL pipeline reader the run itself read its event with (the declaration's raw schema and pure translate).
            AgentGraphRawRowsService,
            { provide: AccountDataReadService, useValue: rows },
            { provide: ConnectionBindingsReadService, useValue: connections },
            { provide: EntityEngineService, useValue: engine },
            { provide: AgentRunRecordsService, useValue: runs },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: WorkspaceMembersReadService, useValue: members },
            { provide: ToolCallLogService, useValue: callLog },
        ],
    }).compile()
    return { service: moduleRef.get(DeskRunsService), engine, runs, callLog, rows }
}

describe("DeskRunsService: the facts of the runs of an agent", () => {
    it("tells each run's question, who asked, the records touched and how it ended; another agent's run is left out", async () => {
        const { service, callLog, rows } = await build()

        await expect(
            service.runFacts("ws-1", "agent-1", ["run-1", "run-2", "run-3", "run-other", "gone"]),
        ).resolves.toEqual([
            {
                runId: "run-1",
                ask: "Minh An has which services expiring?",
                askedBy: null,
                readCount: 4,
                changedCount: null,
                uncounted: 0,
                outcome: "answered",
            },
            {
                runId: "run-2",
                ask: "Record the new email of Phong",
                askedBy: "Anh Tu",
                readCount: null,
                changedCount: 1,
                uncounted: 1,
                outcome: "changed",
            },
            {
                runId: "run-3",
                ask: null,
                askedBy: "Front desk",
                readCount: 0,
                changedCount: 0,
                uncounted: 0,
                outcome: "running",
            },
        ])
        expect(rows.byId).toHaveBeenCalledWith("zalo_oa.event", "row-0")
        expect(callLog.recordsOfRuns).toHaveBeenCalledWith("ws-1", ["run-1", "run-2", "run-3"])
    })

    it("reads the question of a run of the one pipeline from its event: the raw row its context names, translated as the run read it", async () => {
        const { service, rows } = await build()

        const [run] = await service.runsOf("ws-1", "agent-1", ["run-4"])

        expect(run?.ask).toBe("Shop oi con do khong a?")
        expect(rows.byId).toHaveBeenCalledWith("zalo_oa.event", "row-1")
    })

    it("reads the words a source that keeps no raw row carried (`dataJson`), and nothing of an event with no words", async () => {
        const { service } = await build()
        ROWS.set("run-5", runRowOf({ status: "done", context: { verb: TRIGGER.zaloMessageReceived, eventId: "e-5", dataJson: JSON.stringify({ text: "Con hang khong?" }) } }, "run-5"))
        ROWS.set("run-6", runRowOf({ status: "done", context: { verb: TRIGGER.zaloMessageReceived, eventId: "e-6", dataJson: JSON.stringify({ amount: 5 }) } }, "run-6"))

        await expect(service.runsOf("ws-1", "agent-1", ["run-5", "run-6"])).resolves.toEqual([
            { id: "run-5", status: "done", ask: "Con hang khong?", askedBy: null },
            { id: "run-6", status: "done", ask: null, askedBy: null },
        ])
        ROWS.delete("run-5")
        ROWS.delete("run-6")
    })

    it("reads nothing for no run, and leaves a message row it cannot find unasked", async () => {
        const { service, engine, rows } = await build()
        rows.byId.mockResolvedValueOnce(null)

        await expect(service.runsOf("ws-1", "agent-1", [])).resolves.toEqual([])
        expect(engine.scoped).not.toHaveBeenCalled()
        await expect(service.runsOf("ws-1", "agent-1", ["run-1"])).resolves.toEqual([
            { id: "run-1", status: "done", ask: null, askedBy: null },
        ])
    })
})

describe("DeskRunsService: the workspace's day", () => {
    it("counts the runs done that day on the run index and the records the day's calls stated", async () => {
        const { service, runs, callLog } = await build()

        await expect(
            service.today("ws-1", "agent-1", {
                timeZone: "Asia/Ho_Chi_Minh",
                now: new Date("2026-11-12T04:00:00.000Z"),
            }),
        ).resolves.toEqual({ day: "2026-11-12", answered: 7, recordsRead: 41, recordsChanged: 1, uncounted: 2 })
        expect(callLog.recordsOfAgent).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            agentId: "agent-1",
            from: new Date("2026-11-11T17:00:00.000Z"),
            to: new Date("2026-11-12T17:00:00.000Z"),
        })
        expect(runs.runCounts).toHaveBeenCalledWith(tx, {
            agentId: "agent-1",
            statuses: ["done"],
            ended: { from: "2026-11-11T17:00:00.000Z", to: "2026-11-12T17:00:00.000Z" },
        })
    })

    it("counts 0 when the runs table answers no group", async () => {
        const { service, runs } = await build()
        runs.runCounts.mockResolvedValueOnce([])

        await expect(
            service.today("ws-1", "agent-1", { timeZone: "UTC", now: new Date("2026-11-12T04:00:00.000Z") }),
        ).resolves.toMatchObject({ answered: 0 })
    })
})
