import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { FakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { CallLogLine, CallLogRecord } from "./tool-call-log.contracts"
import { ToolCallLogService } from "./tool-call-log.service"
import { ToolCallLogEntity } from "./persistence/entities"

const ROW: CallLogRecord = {
    id: "log-1",
    tool: "hakuen.booking.hold",
    agent_name: "AI Sales",
    outcome: "ok",
    error_code: null,
    args_masked: "{}",
    result_summary: "{}",
    duration_ms: 12,
    approved_by: null,
    created_at: "2026-10-20T02:00:00.000Z",
}

const build = async (entityManager: MockEntityManager) => {
    const agents = mock<AgentDirectoryService>({
        cardsOf: jest
            .fn()
            .mockResolvedValue([{ id: "agent-1", name: "AI Sales", module: "sales" }]),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ToolCallLogService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: AgentDirectoryService, useValue: agents },
        ],
    }).compile()
    return Object.assign(moduleRef.get(ToolCallLogService), { doubles: { agents } })
}

/** What an insert query builder was told to write; a function value is read as what it answers. */
const writtenBy = (fake: FakeQueryBuilder): Record<string, unknown> => {
    const [values] = fake.callsOf("values")[0] ?? []
    const entries: Array<[string, unknown]> =
        typeof values === "object" && values !== null ? Object.entries(values) : []
    return Object.fromEntries(
        entries.map(([key, value]) => [key, typeof value === "function" ? Reflect.apply(value, undefined, []) : value]),
    )
}

const LINE: CallLogLine = {
    workspaceId: "ws-1",
    connector: "hakuen",
    tool: "hakuen.booking.hold",
    agentId: "agent-1",
    conversationId: "conv-1",
    workItemId: null,
    argsMaskedJson: '{"code":"***"}',
    argsHash: "hash",
    outcome: "ok",
    errorCode: null,
    resultSummary: "{}",
    durationMs: 12,
    approvedBy: "person-1",
}

describe("ToolCallLogService", () => {
    it("appends one audit line with every column, the masked arguments cast to jsonb by the database", async () => {
        const fake = fakeQueryBuilder({ execute: { raw: [] } })
        const em = mockEntityManager()
        em.createQueryBuilder.mockReturnValue(fake.builder)
        const log = await build(em)

        await expect(log.append(LINE)).resolves.toBeUndefined()

        const { argsMasked, factReads, ...columns } = writtenBy(fake)
        expect(argsMasked).toContain("CAST(:argsMaskedJson AS jsonb)")
        expect(factReads).toBe("CAST(:factReadsJson AS jsonb)")
        expect(columns).toEqual({
            workspaceId: "ws-1",
            connector: "hakuen",
            tool: "hakuen.booking.hold",
            agentId: "agent-1",
            conversationId: "conv-1",
            workItemId: null,
            argsHash: "hash",
            outcome: "ok",
            errorCode: null,
            resultSummary: "{}",
            durationMs: 12,
            approvedBy: "person-1",
            runId: null,
            originKind: null,
            nodeKey: null,
            workflowId: null,
            workflowVersionId: null,
            recordsRead: null,
            recordsChanged: null,
            connectionId: null,
            provider: null,
            attempt: null,
            chosenBy: null,
            apiKeyId: null,
            actorUserId: null,
        })
        expect(fake.callsOf("insert")).toEqual([[]])
        expect(fake.callsOf("setParameter")).toEqual([
            ["argsMaskedJson", '{"code":"***"}'],
            ["factReadsJson", null],
        ])
    })

    it("hands the masked arguments over as text and leaves reading them to the database", async () => {
        const fake = fakeQueryBuilder({ execute: { raw: [] } })
        const em = mockEntityManager()
        em.createQueryBuilder.mockReturnValue(fake.builder)
        const log = await build(em)

        await expect(log.append({ ...LINE, argsMaskedJson: "{not json" })).resolves.toBeUndefined()

        expect(fake.callsOf("setParameter")).toEqual([
            ["argsMaskedJson", "{not json"],
            ["factReadsJson", null],
        ])
    })

    it("keeps the run of the call and the truths a truth-graph read served, as jsonb (owner order 2026-11-11 item 4)", async () => {
        const fake = fakeQueryBuilder({ execute: { raw: [] } })
        const em = mockEntityManager()
        em.createQueryBuilder.mockReturnValue(fake.builder)
        const log = await build(em)

        await log.append({ ...LINE, runId: "run-7", factReads: [{ factId: "f1", version: 2 }] })

        expect(writtenBy(fake)).toMatchObject({ runId: "run-7", factReads: "CAST(:factReadsJson AS jsonb)" })
        expect(fake.callsOf("setParameter")[1]).toEqual(["factReadsJson", '[{"factId":"f1","version":2}]'])
    })

})

describe("ToolCallLogService: where the call came from and the records it touched", () => {
    it("keeps where the call came from: the origin kind, and the node, workflow and pinned version of a workflow step", async () => {
        const fake = fakeQueryBuilder({ execute: { raw: [] } })
        const em = mockEntityManager()
        em.createQueryBuilder.mockReturnValue(fake.builder)
        const log = await build(em)

        await log.append({
            ...LINE,
            originKind: "node",
            nodeKey: "send-qr",
            workflowId: "wf-1",
            workflowVersionId: "v-3",
        })
        await log.append({ ...LINE, originKind: "mcp_endpoint" })

        expect(writtenBy(fake)).toMatchObject({
            originKind: "node",
            nodeKey: "send-qr",
            workflowId: "wf-1",
            workflowVersionId: "v-3",
        })
        const [, outside] = fake.callsOf("values")
        expect(outside?.[0]).toMatchObject({
            originKind: "mcp_endpoint",
            nodeKey: null,
            workflowId: null,
            workflowVersionId: null,
        })
    })

    it("keeps the records the call's adapter stated, and null where it stated none", async () => {
        const fake = fakeQueryBuilder({ execute: { raw: [] } })
        const em = mockEntityManager()
        em.createQueryBuilder.mockReturnValue(fake.builder)
        const log = await build(em)

        await log.append({ ...LINE, recordsRead: 14, recordsChanged: null })
        await log.append({ ...LINE, recordsChanged: 1 })

        const [read, written] = fake.callsOf("values")
        expect(read?.[0]).toMatchObject({ recordsRead: 14, recordsChanged: null })
        expect(written?.[0]).toMatchObject({ recordsRead: null, recordsChanged: 1 })
    })
})

describe("ToolCallLogService: the records the calls touched", () => {
    it("tallies the ok calls of each run on the run index, leaving out the effect-rights verdict lines", async () => {
        const fake = fakeQueryBuilder({
            getRawMany: [
                {
                    run_id: "run-1",
                    calls: "3",
                    read_sum: "15",
                    read_stated: "2",
                    changed_sum: null,
                    changed_stated: "0",
                    uncounted: "1",
                },
                {
                    run_id: "run-2",
                    calls: "2",
                    read_sum: null,
                    read_stated: "0",
                    changed_sum: null,
                    changed_stated: "0",
                    uncounted: "2",
                },
            ],
        })
        const em = mockEntityManager()
        em.createQueryBuilder.mockReturnValue(fake.builder)
        const log = await build(em)

        await expect(log.recordsOfRuns("ws-1", ["run-1", "run-2", "run-1"])).resolves.toEqual([
            { runId: "run-1", read: 15, changed: null, uncounted: 1 },
            { runId: "run-2", read: null, changed: null, uncounted: 2 },
        ])
        expect(fake.callsOf("where")).toEqual([
            [
                "l.workspace_id = :workspaceId AND l.run_id IN (:...runs)",
                { workspaceId: "ws-1", runs: ["run-1", "run-2"] },
            ],
        ])
        expect(fake.callsOf("andWhere")).toEqual([
            ["l.outcome = 'ok' AND l.connector <> :effectRights", { effectRights: "effect-rights" }],
        ])
        expect(fake.callsOf("groupBy")).toEqual([["l.run_id"]])
    })

    it("reads nothing for no run", async () => {
        const em = mockEntityManager()
        const log = await build(em)

        await expect(log.recordsOfRuns("ws-1", [])).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

})

describe("ToolCallLogService: the records one agent touched in a window", () => {
    it("tallies the ok calls of one agent in a window: no call is 0, calls with no stated count are null", async () => {
        const from = new Date("2026-11-11T17:00:00.000Z")
        const to = new Date("2026-11-12T17:00:00.000Z")
        const counted = fakeQueryBuilder({
            getRawOne: {
                run_id: null,
                calls: 4,
                read_sum: 41,
                read_stated: 3,
                changed_sum: 1,
                changed_stated: 1,
                uncounted: 0,
            },
        })
        const none = fakeQueryBuilder({
            getRawOne: {
                run_id: null,
                calls: "0",
                read_sum: null,
                read_stated: "0",
                changed_sum: null,
                changed_stated: "0",
                uncounted: "0",
            },
        })
        const em = mockEntityManager()
        em.createQueryBuilder.mockReturnValueOnce(counted.builder).mockReturnValueOnce(none.builder)
        const log = await build(em)
        const window = { workspaceId: "ws-1", agentId: "agent-1", from, to }

        await expect(log.recordsOfAgent(window)).resolves.toEqual({ runId: null, read: 41, changed: 1, uncounted: 0 })
        await expect(log.recordsOfAgent(window)).resolves.toEqual({ runId: null, read: 0, changed: 0, uncounted: 0 })
        expect(counted.callsOf("where")).toEqual([
            ["l.workspace_id = :workspaceId AND l.agent_id = :agentId", { workspaceId: "ws-1", agentId: "agent-1" }],
        ])
        expect(counted.callsOf("andWhere")[0]).toEqual(["l.created_at >= :from AND l.created_at < :to", { from, to }])
    })
})

describe("ToolCallLogService: reading the log", () => {
    it("reads the truth reads of one run, oldest first, bounded, only the lines that kept some", async () => {
        const at = new Date("2026-11-11T10:00:00.000Z")
        const fake = fakeQueryBuilder({
            getMany: [
                { id: "l1", tool: "nivo.tool.brain.search", createdAt: at, factReads: [{ factId: "f1", version: 2 }] },
            ],
        })
        const em = mockEntityManager()
        em.createQueryBuilder.mockReturnValue(fake.builder)
        const log = await build(em)

        await expect(log.truthReadsOfRun("ws-1", "run-7", 100)).resolves.toEqual([
            { id: "l1", tool: "nivo.tool.brain.search", at, facts: [{ factId: "f1", version: 2 }] },
        ])
        expect(fake.callsOf("where")).toEqual([
            [
                "l.workspaceId = :workspaceId AND l.runId = :runId AND l.factReads IS NOT NULL",
                { workspaceId: "ws-1", runId: "run-7" },
            ],
        ])
        expect(fake.callsOf("orderBy")).toEqual([["l.createdAt", "ASC"]])
        expect(fake.callsOf("limit")).toEqual([[100]])
    })

    it("reads the accounts an `ok` call of the run acted on, the most recent first, each once", async () => {
        const at = new Date("2026-11-14T02:00:00.000Z")
        const fake = fakeQueryBuilder({
            getMany: [
                Object.assign(new ToolCallLogEntity(), { id: "l3", connectionId: "sandbox", createdAt: at }),
                Object.assign(new ToolCallLogEntity(), { id: "l2", connectionId: "live", createdAt: at }),
                Object.assign(new ToolCallLogEntity(), { id: "l1", connectionId: "sandbox", createdAt: at }),
            ],
        })
        const em = mockEntityManager()
        em.createQueryBuilder.mockReturnValue(fake.builder)
        const log = await build(em)

        await expect(log.connectionsUsedByRun("ws-1", "run-7", 20)).resolves.toEqual(["sandbox", "live"])
        expect(fake.callsOf("where")[0]?.[1]).toEqual({ workspaceId: "ws-1", runId: "run-7", effectRights: "effect-rights" })
        expect(fake.callsOf("orderBy")).toEqual([["l.createdAt", "DESC"]])
        expect(fake.callsOf("limit")).toEqual([[20]])
    })

    it("reads the newest lines of the workspace within the page, each named after its agent", async () => {
        const { agent_name: _name, ...stored } = ROW
        const fake = fakeQueryBuilder({
            getRawMany: [
                { ...stored, agent_id: "agent-1" },
                { ...stored, id: "log-2", agent_id: "gone" },
                { ...stored, id: "log-3", agent_id: null },
            ],
        })
        const em = mockEntityManager()
        em.createQueryBuilder.mockReturnValue(fake.builder)
        const log = await build(em)

        await expect(log.latest({ workspaceId: "ws-1", limit: 50 })).resolves.toEqual([
            ROW,
            { ...ROW, id: "log-2", agent_name: "" },
            { ...ROW, id: "log-3", agent_name: "" },
        ])
        expect(em.createQueryBuilder).toHaveBeenCalledWith(ToolCallLogEntity, "l")
        expect(log.doubles.agents.cardsOf).toHaveBeenCalledWith("ws-1", ["agent-1", "gone"])
        expect(fake.callsOf("where")).toEqual([["l.workspace_id = :workspaceId", { workspaceId: "ws-1" }]])
        expect(fake.callsOf("orderBy")).toEqual([["l.created_at", "DESC"]])
        expect(fake.callsOf("limit")).toEqual([[50]])
    })
})
