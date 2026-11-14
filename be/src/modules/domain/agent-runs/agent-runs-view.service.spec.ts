import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { EntityEngineService } from "@modules/domain/entity-engine"
import { AgentRunRecordsService } from "./agent-run-records.service"
import { AgentRunsViewService, stepDetailOf } from "./agent-runs-view.service"
import { wireScope } from "@tests/fixtures/builders/agent-graph-records.builder"
import { runRecordOf, runRowOf, stepRowOf } from "@tests/fixtures/builders/agent-runs.builder"
import type { StoredStep } from "./agent-runs-rows.contracts"

const stepRow = (data: Record<string, unknown>): StoredStep =>
    stepRowOf(
        {
            createdAt: "2026-11-09T07:59:00.000Z",
            updatedAt: "2026-11-09T07:59:00.000Z",
            runId: "run-1",
            ordinal: 1,
            stepKey: "evidence",
            nodeKey: "evidence",
            kind: "graph_node",
            effect: { kind: "read" },
            input: {},
            result: null,
            status: "failed",
            attempt: 2,
            maxAttempts: 3,
            deadlineMs: 1000,
            claimedUntil: null,
            notBefore: null,
            waitItemId: null,
            workItemId: null,
            errorCode: "tool_denied",
            startedAt: "2026-11-09T07:59:01.000Z",
            endedAt: "2026-11-09T07:59:03.000Z",
            durationMs: 2000,
            doorCalls: { calls: [{ tool: "sheets.append", ok: false, failure: "403", effectKey: "k" }, { tool: 1 }] },
            ...data,
        },
        "s-1",
        "1",
    )

describe("stepDetailOf", () => {
    it("reads the moments, the tries, the error and the door calls of a step row, dropping a call that names no tool", () => {
        expect(stepDetailOf(stepRow({}))).toMatchObject({
            stepKey: "evidence",
            status: "failed",
            attempt: 2,
            durationMs: 2000,
            errorCode: "tool_denied",
            calls: [{ tool: "sheets.append", ok: false, failure: "403" }],
        })
    })

    it("tells a step that has not begun with no moment", () => {
        expect(stepDetailOf(stepRow({ startedAt: null, endedAt: null, durationMs: null })).startedAt).toBeNull()
    })
})

const build = async (): Promise<{
    service: AgentRunsViewService
    engine: ReturnType<typeof mock<EntityEngineService>>
    records: ReturnType<typeof mock<AgentRunRecordsService>>
}> => {
    const engine = mock<EntityEngineService>()
    wireScope(engine)
    const records = mock<AgentRunRecordsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentRunsViewService,
            { provide: EntityEngineService, useValue: engine },
            { provide: AgentRunRecordsService, useValue: records },
        ],
    }).compile()
    return { service: moduleRef.get(AgentRunsViewService), engine, records }
}

describe("AgentRunsViewService", () => {
    it("lists the newest runs of the agent with the progress of their steps and the work item of each", async () => {
        const { service, records } = await build()
        records.runsOfAgent.mockResolvedValue([runRecordOf({ id: "run-1" }), runRecordOf({ id: "run-2" })])
        records.stepCountsOf.mockResolvedValue([{ runId: "run-1", total: 5, done: 2, begun: 3, failed: 0 }])
        records.workItemsOf.mockResolvedValue([{ runId: "run-2", workItemId: "w-9" }])

        const entries = await service.list("ws-1", "agent-1")

        expect(entries[0]).toMatchObject({ stepTotal: 5, stepDone: 2, stepBegun: 3, workItemId: null })
        expect(entries[1]).toMatchObject({ stepTotal: 0, workItemId: "w-9" })
        expect(records.runsOfAgent).toHaveBeenCalledWith(expect.anything(), "agent-1", 50)
    })

    it("answers the run with its steps and its engine, and nothing for a run of another agent or a run that is not there", async () => {
        const { service, records } = await build()
        records.runRow
            .mockResolvedValueOnce(runRowOf({ engine: "langgraph" }, "run-1"))
            .mockResolvedValueOnce(runRowOf({ engine: "legacy" }, "run-0"))
            .mockResolvedValueOnce(runRowOf({ agentId: "agent-2" }, "run-2"))
            .mockResolvedValueOnce(null)
        records.stepRowsOf.mockResolvedValue([stepRow({})])

        await expect(service.detail("ws-1", "agent-1", "run-1")).resolves.toMatchObject({
            run: { id: "run-1" },
            engine: "langgraph",
            steps: [{ stepKey: "evidence" }],
        })
        await expect(service.detail("ws-1", "agent-1", "run-0")).resolves.toMatchObject({ engine: "legacy" })
        await expect(service.detail("ws-1", "agent-1", "run-2")).resolves.toBeNull()
        await expect(service.detail("ws-1", "agent-1", "run-3")).resolves.toBeNull()
        expect(records.runRow).toHaveBeenCalledWith(expect.anything(), "run-1")
    })
})
