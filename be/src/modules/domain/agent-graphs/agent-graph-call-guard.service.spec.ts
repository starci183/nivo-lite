import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { AgentRunsService } from "@modules/domain/agent-runs"
import type { RunView } from "@modules/domain/agent-runs"
import { EntityEngineService } from "@modules/domain/entity-engine"
import { SCOPE, wireScope } from "@tests/fixtures/builders/agent-graph-records.builder"
import { runViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import { AgentGraphCallGuardService } from "./agent-graph-call-guard.service"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import type { WorkflowRoute } from "./agent-workflows.contracts"

const FLOW: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["agent"] },
    grant: { rights: [], tools: [], effects: [] },
    nodes: [{ key: "end", kind: "output", step: "stop" }],
}

const ROUTE: WorkflowRoute = {
    agentId: "sales",
    workflowId: "wf-after-sale",
    versionId: "v-1",
    workflowVersionId: "wfv-1",
    workflowVersion: 1,
    flow: FLOW,
}

const PARAMS = { leadId: "lead-1", orderId: "order-1" }

/** The plain data of a hand-off wake, as `core.call-workflow` writes it. */
const tagOf = (callerRunId: string, params: Readonly<Record<string, unknown>> = PARAMS): string =>
    JSON.stringify({
        workflowCall: { workflow: "after-sale", version: "latest" },
        params,
        caller: { runId: callerRunId },
    })

const TURN = agentTurnViewOf({ agentId: "sales", wakeId: "wake-9", source: "tag" })

const triggerOf = (callerRunId: string, params: Readonly<Record<string, unknown>> = PARAMS) => ({
    leadId: "lead-1",
    context: { caller: { runId: callerRunId }, params },
})

/** A run of the workspace, called by `callerRunId` when one is named. */
const runOf = (id: string, agentId: string, callerRunId: string | null, over: Partial<RunView> = {}): RunView =>
    runViewOf({
        id,
        agentId,
        status: "done",
        wakeId: `wake-${id}`,
        context: { leadId: "lead-1", ...(callerRunId === null ? {} : { tagContext: tagOf(callerRunId) }) },
        ...over,
    })

const build = async (
    runs: ReadonlyArray<RunView>,
    pins: Readonly<Record<string, string>> = {},
    standing: ReadonlyArray<string> = [],
) => {
    const byId = new Map(runs.map((run) => [run.id, run]))
    const agentRuns = mock<AgentRunsService>({
        runOf: jest.fn((_ws: string, id: string) => Promise.resolve(byId.get(id) ?? null)),
    })
    const engine = mock<EntityEngineService>()
    wireScope(engine)
    const records = mock<AgentWorkflowRecordsService>({
        runsOfWorkflow: jest.fn().mockResolvedValue(standing.map((runId) => ({ runId, workflowId: ROUTE.workflowId }))),
    })
    const workflows = mock<AgentWorkflowRunsService>({
        pinsOf: jest.fn((_ws: string, ids: ReadonlyArray<string>) =>
            Promise.resolve(
                ids.flatMap((runId) =>
                    pins[runId] === undefined
                        ? []
                        : [{ runId, workflowId: pins[runId] ?? "", workflowName: "", version: 1 }],
                ),
            ),
        ),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphCallGuardService,
            { provide: AgentRunsService, useValue: agentRuns },
            { provide: EntityEngineService, useValue: engine },
            { provide: AgentWorkflowRecordsService, useValue: records },
            { provide: AgentWorkflowRunsService, useValue: workflows },
        ],
    }).compile()
    return { guard: moduleRef.get(AgentGraphCallGuardService), records }
}

describe("AgentGraphCallGuardService: who may call", () => {
    it("lets a wake no call made through untouched", async () => {
        const { guard } = await build([])
        await expect(guard.refusalOf(TURN, { leadId: "lead-1" }, { flow: FLOW, route: ROUTE })).resolves.toBeNull()
    })

    it("lets a call of the workspace start, and refuses one whose calling run is not of this workspace", async () => {
        const { guard } = await build([runOf("run-c", "chatbot", null)])
        await expect(guard.refusalOf(TURN, triggerOf("run-c"), { flow: FLOW, route: ROUTE })).resolves.toBeNull()
        await expect(guard.refusalOf(TURN, triggerOf("run-gone"), { flow: FLOW, route: ROUTE })).resolves.toBe(
            "call_caller_unknown",
        )
        const other = await build([runOf("run-x", "chatbot", null, { workspaceId: "ws-2" })])
        await expect(other.guard.refusalOf(TURN, triggerOf("run-x"), { flow: FLOW, route: ROUTE })).resolves.toBe(
            "call_caller_unknown",
        )
    })

    it("refuses a call of another agent when the target is open only to its own agent's workflows", async () => {
        const closed: GraphSpec = { ...FLOW, entry: { openTo: "agent" } }
        const { guard } = await build([runOf("run-c", "chatbot", null), runOf("run-s", "sales", null)])
        await expect(guard.refusalOf(TURN, triggerOf("run-c"), { flow: closed, route: ROUTE })).resolves.toBe(
            "call_not_open",
        )
        await expect(guard.refusalOf(TURN, triggerOf("run-s"), { flow: closed, route: ROUTE })).resolves.toBeNull()
    })
})

describe("AgentGraphCallGuardService: chains and duplicates", () => {
    it("refuses A calling B calling A on the same lead with the same params", async () => {
        // run-a1 (this target's workflow, called by run-a0 with PARAMS) called run-b, which now calls the target again with PARAMS.
        const runs = [
            runOf("run-a0", "chatbot", null),
            runOf("run-a1", "sales", "run-a0"),
            runOf("run-b", "chatbot", "run-a1"),
        ]
        const { guard } = await build(runs, { "run-a1": ROUTE.workflowId })
        await expect(guard.refusalOf(TURN, triggerOf("run-b"), { flow: FLOW, route: ROUTE })).resolves.toBe(
            "call_cycle",
        )
        const other = { leadId: "lead-1", orderId: "order-2" }
        await expect(guard.refusalOf(TURN, triggerOf("run-b", other), { flow: FLOW, route: ROUTE })).resolves.toBeNull()
    })

    it("refuses a chain past the depth limit", async () => {
        const runs = Array.from({ length: 9 }, (_, at) =>
            runOf(`run-${at}`, `agent-${at}`, at === 0 ? null : `run-${at - 1}`),
        )
        const { guard } = await build(runs)
        await expect(guard.refusalOf(TURN, triggerOf("run-8"), { flow: FLOW, route: ROUTE })).resolves.toBe(
            "call_too_deep",
        )
        await expect(guard.refusalOf(TURN, triggerOf("run-5"), { flow: FLOW, route: ROUTE })).resolves.toBeNull()
    })

    it("starts no second run of the target for the same lead and params while one stands, and lets a replay of the same wake through", async () => {
        const caller = runOf("run-c", "chatbot", null)
        const standing = runOf("run-t", "sales", "run-c", { status: "parked" })
        const replay = runOf("run-r", "sales", "run-c", { status: "running", wakeId: "wake-9" })
        const done = runOf("run-d", "sales", "run-c", { status: "done" })
        const { guard, records } = await build([caller, standing, replay, done], {}, ["run-t"])
        await expect(guard.refusalOf(TURN, triggerOf("run-c"), { flow: FLOW, route: ROUTE })).resolves.toBe(
            "call_duplicate",
        )
        expect(records.runsOfWorkflow).toHaveBeenCalledWith(SCOPE, "sales", "wf-after-sale", 20)

        const quiet = await build([caller, replay, done], {}, ["run-r", "run-d"])
        await expect(quiet.guard.refusalOf(TURN, triggerOf("run-c"), { flow: FLOW, route: ROUTE })).resolves.toBeNull()
        await expect(quiet.guard.refusalOf(TURN, triggerOf("run-c"), { flow: FLOW, route: null })).resolves.toBeNull()
    })
})
