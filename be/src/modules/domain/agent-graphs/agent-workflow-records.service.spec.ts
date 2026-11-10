import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { EngineResult, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { SCOPE, pageOf } from "@tests/fixtures/builders/agent-graph-records.builder"
import { EntityEngineService, EntityMutationService } from "@modules/domain/entity-engine"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"

const build = async () => {
    const engine = mock<EntityEngineService>()
    const mutations = mock<EntityMutationService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentWorkflowRecordsService,
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityMutationService, useValue: mutations },
        ],
    }).compile()
    return { service: moduleRef.get(AgentWorkflowRecordsService), engine, mutations }
}

const rowOf = (id: string, data: RecordRow["data"]): RecordRow => ({
    id,
    workspaceId: "ws-1",
    version: "2",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    data,
})

const WORKFLOW = rowOf("wf-1", {
    agentId: "agent-1",
    key: "reports",
    name: "Reports",
    status: "draft",
    primary: false,
    position: 1,
    activeVersionId: null,
    latestNumber: 0,
    templateId: "accounting.reports",
    templateVersion: 1,
    createdBy: null,
})

const PIN = rowOf("pin-1", { runId: "run-1", workflowId: "wf-1", workflowVersionId: "wfv-1", workflowVersion: 1 })

const written = (row: RecordRow): EngineResult => ({ ok: true, row, version: row.version, created: true })

const codeOf = async (work: Promise<unknown>): Promise<unknown> => {
    try {
        await work
        return null
    } catch (cause) {
        return cause instanceof AgentGraphsError ? cause.code : cause
    }
}

describe("AgentWorkflowRecordsService: workflows", () => {
    it("reads one workflow and the workflows of an agent in list order", async () => {
        const { service, engine } = await build()
        engine.get.mockResolvedValue(WORKFLOW)
        engine.list.mockResolvedValue(pageOf([WORKFLOW]))

        await expect(service.workflow(SCOPE, "wf-1")).resolves.toMatchObject({ id: "wf-1", fence: "2" })
        await expect(service.workflowsOf(SCOPE, "agent-1", 50)).resolves.toHaveLength(1)
        expect(engine.list.mock.calls[0]?.[1]).toMatchObject({
            from: "agent.workflow",
            where: { op: "eq", field: "agentId", value: "agent-1" },
            order: [
                ["position", "asc"],
                ["id", "asc"],
            ],
        })
    })

    it("answers null for a taken key or a moved fence, and refuses any other refusal", async () => {
        const { service, mutations } = await build()
        mutations.mutate.mockResolvedValueOnce({
            ok: false,
            reason: "taken",
            constraint: "agent_key",
            refusal: "workflow-exists",
        })
        mutations.mutate.mockResolvedValueOnce({ ok: false, reason: "stale" })
        mutations.mutate.mockResolvedValueOnce({ ok: false, reason: "invalid" })

        await expect(service.insertWorkflow(SCOPE, {})).resolves.toBeNull()
        await expect(service.patchWorkflow(SCOPE, await rowRecord(), { status: "active" })).resolves.toBeNull()
        await expect(codeOf(service.insertVersion(SCOPE, {}))).resolves.toBe(AgentGraphsErrorCode.RecordUnreadable)
    })
})

/** The record of the workflow row, read through the service's own mapper. */
const rowRecord = async () => {
    const { service, engine } = await build()
    engine.get.mockResolvedValue(WORKFLOW)
    const record = await service.workflow(SCOPE, "wf-1")
    if (record === null) throw new AgentGraphsError({ code: AgentGraphsErrorCode.WorkflowNotFound })
    return record
}

describe("AgentWorkflowRecordsService: pins", () => {
    it("pins a run under its match key and reads the pins of runs", async () => {
        const { service, engine, mutations } = await build()
        mutations.mutate.mockResolvedValue(written(PIN))
        engine.list.mockResolvedValue(pageOf([PIN]))

        await service.pinRun(SCOPE, { runId: "run-1" })
        const pins = await service.pinsOf(SCOPE, ["run-1"])

        expect(mutations.mutate).toHaveBeenCalledWith(
            SCOPE,
            { op: "ensure", entity: "agent.run-workflow", match: "run", values: { runId: "run-1" } },
            "job",
        )
        expect(pins).toEqual([{ runId: "run-1", workflowId: "wf-1", workflowVersionId: "wfv-1", workflowVersion: 1 }])
        await expect(service.pinsOf(SCOPE, [])).resolves.toEqual([])
    })

    it("reads the newest runs of one workflow", async () => {
        const { service, engine } = await build()
        engine.list.mockResolvedValue(pageOf([PIN]))

        await expect(service.runsOfWorkflow(SCOPE, "agent-1", "wf-1", 20)).resolves.toHaveLength(1)
        expect(engine.list.mock.calls[0]?.[1]).toMatchObject({ from: "agent.run-workflow" })
    })
})
