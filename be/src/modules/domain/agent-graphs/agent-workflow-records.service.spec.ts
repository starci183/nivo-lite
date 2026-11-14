import { Test } from "@nestjs/testing"
import { SCOPE } from "@tests/fixtures/builders/agent-graph-records.builder"
import {
    AGENT_RUNS,
    MemoryTables,
    RUN_DEFAULTS,
    memoryRunStore,
    memoryWorkflowStore,
} from "@tests/fixtures/builders/engine-core-tables.builder"
import { AgentRunRecordsService } from "@modules/domain/agent-runs"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import { AGENT_WORKFLOW_STORE } from "./agent-workflow-store.port"
import type { WorkflowInsert, WorkflowVersionInsert } from "./agent-workflows.contracts"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"

const build = async () => {
    const tables = new MemoryTables()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentWorkflowRecordsService,
            { provide: AGENT_WORKFLOW_STORE, useValue: memoryWorkflowStore(tables) },
            { provide: AgentRunRecordsService, useValue: new AgentRunRecordsService(memoryRunStore(tables)) },
        ],
    }).compile()
    return { service: moduleRef.get(AgentWorkflowRecordsService), tables }
}

const WORKFLOW = (key: string, position: number): WorkflowInsert => ({
    agentId: "agent-1",
    key,
    name: key,
    status: "draft",
    primary: false,
    position,
    latestNumber: 0,
    activeVersionId: null,
    templateId: "accounting.team-chat",
    templateVersion: 1,
    createdBy: null,
})

const VERSION = (workflowId: string, number: number): WorkflowVersionInsert => ({
    workflowId,
    agentId: "agent-1",
    number,
    document: { nodes: [] },
    documentHash: "h",
    changeKind: "template",
    authorKind: "system",
    authorId: null,
    note: "",
    templateId: null,
    templateVersion: null,
    fromNumber: null,
    graphVersionId: null,
})

/** A run a wake opened (the pin is written into its row, in the transaction that opens it). */
const opened = (tables: MemoryTables, runId: string, startedAt: string): void => {
    tables.put(AGENT_RUNS, runId, {
        ...RUN_DEFAULTS,
        agentId: "agent-1",
        wakeId: `wake-${runId}`,
        trigger: "tag",
        graphVersionId: null,
        context: {},
        startedAt,
    })
}

describe("AgentWorkflowRecordsService: workflows", () => {
    it("reads one workflow and the workflows of an agent in list order", async () => {
        const { service } = await build()
        await service.insertWorkflow(SCOPE, WORKFLOW("second", 1))
        const first = await service.insertWorkflow(SCOPE, WORKFLOW("reports", 0))

        await expect(service.workflow(SCOPE, first?.id ?? "")).resolves.toMatchObject({ key: "reports", fence: "1" })
        const listed = await service.workflowsOf(SCOPE, "agent-1", 50)
        expect(listed.map((workflow) => workflow.key)).toEqual(["reports", "second"])
    })

    it("answers null for a taken key, a moved fence and a version number the workflow holds", async () => {
        const { service } = await build()
        const workflow = await service.insertWorkflow(SCOPE, WORKFLOW("reports", 0))
        if (workflow === null) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "no workflow" } })

        await expect(service.insertWorkflow(SCOPE, WORKFLOW("reports", 1))).resolves.toBeNull()
        await expect(service.patchWorkflow(SCOPE, workflow, { status: "active" })).resolves.toMatchObject({ status: "active" })
        await expect(service.patchWorkflow(SCOPE, workflow, { status: "paused" })).resolves.toBeNull()
        await expect(service.insertVersion(SCOPE, VERSION(workflow.id, 1))).resolves.toMatchObject({ number: 1 })
        await expect(service.insertVersion(SCOPE, VERSION(workflow.id, 1))).resolves.toBeNull()
    })
})

describe("AgentWorkflowRecordsService: pins", () => {
    it("pins a run once and reads the pins of runs", async () => {
        const { service, tables } = await build()
        opened(tables, "run-1", "2026-11-01T00:00:00.000Z")
        const pin = { runId: "run-1", agentId: "agent-1", workflowId: "wf-1", workflowVersionId: "wfv-1", workflowVersion: 1 }

        await service.pinRun(SCOPE, pin)
        await service.pinRun(SCOPE, { ...pin, workflowVersionId: "wfv-2", workflowVersion: 2 })
        const pins = await service.pinsOf(SCOPE, ["run-1"])

        expect(pins).toEqual([{ runId: "run-1", workflowId: "wf-1", workflowVersionId: "wfv-1", workflowVersion: 1 }])
        await expect(service.pinsOf(SCOPE, [])).resolves.toEqual([])
    })

    it("reads the newest runs of one workflow", async () => {
        const { service, tables } = await build()
        opened(tables, "run-1", "2026-11-01T00:00:00.000Z")
        opened(tables, "run-2", "2026-11-02T00:00:00.000Z")
        const pin = { agentId: "agent-1", workflowId: "wf-1", workflowVersionId: "wfv-1", workflowVersion: 1 }
        await service.pinRun(SCOPE, { ...pin, runId: "run-1" })
        await service.pinRun(SCOPE, { ...pin, runId: "run-2" })

        const runs = await service.runsOfWorkflow(SCOPE, "agent-1", "wf-1", 20)
        expect(runs.map((run) => run.runId)).toEqual(["run-2", "run-1"])
    })
})
