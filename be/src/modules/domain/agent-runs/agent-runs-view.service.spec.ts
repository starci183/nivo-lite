import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { EntityEngineService } from "@modules/domain/entity-engine"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { AgentRunRecordsService } from "./agent-run-records.service"
import { AgentRunsViewService, stepDetailOf } from "./agent-runs-view.service"
import { wireScope } from "@tests/fixtures/builders/agent-graph-records.builder"

const runOf = (id: string, agentId = "agent-1"): never => ({ id, agentId }) as never

const stepRow = (data: Record<string, unknown>): RecordRow =>
    ({
        id: "s-1",
        version: "1",
        workspaceId: "ws-1",
        data: {
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
            compAttempts: 0,
            errorCode: "tool_denied",
            startedAt: "2026-11-09T07:59:01.000Z",
            endedAt: "2026-11-09T07:59:03.000Z",
            durationMs: 2000,
            doorCalls: { calls: [{ tool: "sheets.append", ok: false, failure: "403", effectKey: "k" }, { tool: 1 }] },
            ...data,
        },
    }) as unknown as RecordRow

const engineOf = (): EntityEngineService => {
    const engine = mock<EntityEngineService>()
    wireScope(engine)
    return engine
}

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

const build = async (records: AgentRunRecordsService): Promise<AgentRunsViewService> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentRunsViewService,
            { provide: EntityEngineService, useValue: engineOf() },
            { provide: AgentRunRecordsService, useValue: records },
        ],
    }).compile()
    return moduleRef.get(AgentRunsViewService)
}

describe("AgentRunsViewService", () => {
    it("lists the newest runs of the agent with the progress of their steps and the work item of each", async () => {
        const records = mock<AgentRunRecordsService>({
            runsOfAgent: jest.fn().mockResolvedValue([runOf("run-1"), runOf("run-2")]),
            stepCountsOf: jest.fn().mockResolvedValue([
                { groups: { runId: "run-1" }, measures: { total: 5, done: 2, begun: 3, failed: 0 } },
            ]),
            workItemsOf: jest.fn().mockResolvedValue([
                { groups: { runId: "run-2", workItemId: "w-9" }, measures: { steps: 1 } },
            ]),
        })
        const service = await build(records)

        const entries = await service.list("ws-1", "agent-1")

        expect(entries[0]).toMatchObject({ stepTotal: 5, stepDone: 2, stepBegun: 3, workItemId: null })
        expect(entries[1]).toMatchObject({ stepTotal: 0, workItemId: "w-9" })
        expect(records.runsOfAgent).toHaveBeenCalledWith(expect.anything(), "agent-1", 50)
    })

    it("answers the run with its steps, and nothing for a run of another agent or a run that is not there", async () => {
        const records = mock<AgentRunRecordsService>({
            run: jest.fn().mockResolvedValueOnce(runOf("run-1")).mockResolvedValueOnce(runOf("run-2", "agent-2")).mockResolvedValueOnce(null),
            stepRowsOf: jest.fn().mockResolvedValue([stepRow({})]),
        })
        const service = await build(records)

        await expect(service.detail("ws-1", "agent-1", "run-1")).resolves.toMatchObject({ steps: [{ stepKey: "evidence" }] })
        await expect(service.detail("ws-1", "agent-1", "run-2")).resolves.toBeNull()
        await expect(service.detail("ws-1", "agent-1", "run-3")).resolves.toBeNull()
    })
})
