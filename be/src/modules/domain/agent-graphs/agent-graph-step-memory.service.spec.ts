import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { coreNodes } from "@nivo-lite/blocks-core"
import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { NodeBusinessFailure } from "@nivo-lite/agent-sdk/node"
import type { LeadMemorySnapshot, MemoryWrite, StepMemory } from "@nivo-lite/agent-sdk/node"
import { stepViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { FLOW as NODE_STEP_FLOW, stepOf as nodeStepOf } from "@tests/fixtures/builders/agent-graph-node-step.builder"
import { AgentRunHandlersService } from "@modules/domain/agent-runs"
import type { StepSpec } from "@modules/domain/agent-runs"
import { AgentTagService } from "@modules/domain/agent-work"
import { GraphNodeHostService, GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { LeadMemoryService } from "@modules/domain/lead-memory"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { AgentGraphFlowRunsService } from "./agent-graph-flow-runs.service"
import { AgentGraphNodeStepService } from "./agent-graph-node-step.service"
import { AgentGraphRunNoticesService } from "./agent-graph-run-notices.service"
import { AgentGraphStepMemoryService, failureOfResult, stepsOfRun } from "./agent-graph-step-memory.service"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphDocument } from "./agent-graphs.contracts"
import type { GraphNodeStepInput } from "./policies/graph-flow.policy"
import { EMPTY_GRANT, ownRunGrantOf } from "./policies/workflow-grant.policy"

const NOW = Date.parse("2026-11-09T10:00:00.000Z")
const ADDRESS = "335 Ba Trieu"
const ORDER_STEP = "sales.create-order"

/** The lead facts the order step of this spec proves by its output: no shipped node declares any, the engine still writes them. */
const ORDER_FACTS = { address: "address", lastOrderId: "orderId" } as const

const ORDER_NODE: GraphSpecNode = {
    key: "order",
    kind: "output",
    step: ORDER_STEP,
    params: {
        leadId: { $ref: "trigger.leadId" },
        address: { $ref: "lead.address" },
        stray: { $ref: "out.items" },
    },
}

const FLOW: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["channel"] },
    grant: { rights: [], tools: [], effects: [] },
    nodes: [{ key: "won", kind: "output", step: "core.outcome", next: "order" }, ORDER_NODE],
}

const SNAPSHOT: LeadMemorySnapshot = {
    subject: { key: "lead:l1", leadId: "l1", conversationId: "c1" },
    lead: { address: ADDRESS },
    workflows: {},
}

const DONE: StepMemory = {
    status: "done",
    output: { orderId: "o1" },
    error: null,
    runId: "run-1",
    versionId: "v1",
    at: "",
}

const FAILURE = { code: "address_missing", messageKey: "k", message: "m", fields: { field: "address" } }

const STEP = stepViewOf({
    runId: "run-1",
    stepKey: "order",
    nodeKey: "order",
    earlier: {
        won: { output: { outcome: "won", values: { items: ["rose"] } }, effects: [] },
        check: {
            output: null,
            effects: [],
            error: { code: "out_of_stock", message: "none left", fields: { sku: "rose" } },
        },
    },
})

const input = (
    trigger: Readonly<Record<string, string>>,
    extra: Partial<GraphNodeStepInput> = {},
): GraphNodeStepInput => ({
    versionId: "v1",
    nodeKey: "order",
    trigger,
    namespace: "sales.consult",
    workflowId: "wf-1",
    ...extra,
})

/** The step memory service over the real order node (declaring `ORDER_FACTS`), with the lead memory double unless `withMemory` is false. */
const build = async (withMemory: boolean = true) => {
    const installed = coreNodes
        .filter((node) => node.id === ORDER_STEP)
        .map((node) => [node.id, { ...node, facts: ORDER_FACTS }] as const)
    const nodes = mock<GraphNodeRegistryService>({
        installed: jest.fn().mockReturnValue({ nodes: new Map(installed) }),
    })
    const memory = mock<LeadMemoryService>({
        snapshot: jest.fn().mockResolvedValue(SNAPSHOT),
        stepOf: jest.fn().mockResolvedValue(null),
        write: jest.fn().mockResolvedValue(undefined),
        adopt: jest.fn().mockResolvedValue(undefined),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphStepMemoryService,
            { provide: GraphNodeRegistryService, useValue: nodes },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            ...(withMemory ? [{ provide: LeadMemoryService, useValue: memory }] : []),
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphStepMemoryService), memory }
}

/** The one write the memory double took. */
const writtenOf = (memory: jest.Mocked<LeadMemoryService>): MemoryWrite | undefined =>
    memory.write.mock.calls.at(0)?.[1]

describe("AgentGraphStepMemoryService: the scope and the binding", () => {
    it("reads the outcomes of this run, a failure as failed", () => {
        const steps = stepsOfRun(STEP, "v1")
        expect(steps["won"]).toMatchObject({ status: "done", output: { outcome: "won", values: { items: ["rose"] } } })
        expect(steps["check"]).toMatchObject({ status: "failed", output: null, error: { code: "out_of_stock" } })
        expect(failureOfResult({ error: "x" })).toBeNull()
    })

    it("binds a node from the trigger, the lead memory and the last outcome, split by the node's schemas", async () => {
        const { service, memory } = await build()
        const scope = await service.scopeOf(STEP, FLOW, input({ leadId: "l1", conversationId: "c1" }))
        expect(memory.snapshot).toHaveBeenCalledWith(STEP.workspaceId, SNAPSHOT.subject, "step")
        expect(scope.out).toEqual({ items: ["rose"] })
        expect(scope.namespace).toBe("sales.consult")
        expect(service.bind(ORDER_NODE, scope)).toEqual({ params: {}, input: { leadId: "l1", address: ADDRESS } })
    })

    it("recalls a step done in this run, keyed per iteration, and nothing for a run about no customer", async () => {
        const { service, memory } = await build()
        memory.stepOf.mockResolvedValueOnce(DONE)
        await expect(service.recalled(STEP, input({ leadId: "l1" }))).resolves.toEqual(DONE)
        expect(memory.stepOf).toHaveBeenCalledWith(
            STEP.workspaceId,
            expect.objectContaining({ key: "lead:l1" }),
            "run-1",
            "order",
        )
        await expect(service.recalled(STEP, input({}))).resolves.toBeNull()
        await expect(
            service.recalled(STEP, input({ leadId: "l1" }, { item: { value: "a", index: 2 } })),
        ).resolves.toBeNull()
        expect(memory.stepOf).toHaveBeenLastCalledWith(STEP.workspaceId, expect.anything(), "run-1", "order[2]")
    })
})

describe("AgentGraphStepMemoryService: the writes", () => {
    it("keeps an outcome with the facts the node proves, and moves a conversation's memory to the lead the step named", async () => {
        const { service, memory } = await build()
        const output = { orderId: "o1", address: ADDRESS, leadId: "l9" }
        await service.remember(STEP, FLOW, ORDER_NODE, input({ conversationId: "c1" }), {
            status: "done",
            output,
            error: null,
        })
        expect(memory.adopt).toHaveBeenCalledWith(STEP.workspaceId, "c1", "l9")
        expect(writtenOf(memory)).toMatchObject({
            subject: { key: "lead:l9", leadId: "l9", conversationId: "c1" },
            namespace: "sales.consult",
            workflowId: "wf-1",
            nodeKey: "order",
            facts: { address: ADDRESS, lastOrderId: "o1" },
            outcome: { status: "done", runId: "run-1", versionId: "v1", at: "2026-11-09T10:00:00.000Z" },
        })
    })

    it("writes no fact for a failure, and nothing at all without the memory capability", async () => {
        const { service, memory } = await build()
        await service.remember(STEP, FLOW, ORDER_NODE, input({ leadId: "l1" }), {
            status: "failed",
            output: null,
            error: FAILURE,
        })
        expect(writtenOf(memory)).toMatchObject({ facts: {} })
        const bare = await build(false)
        await bare.service.remember(STEP, FLOW, ORDER_NODE, input({ leadId: "l1" }), {
            status: "failed",
            output: null,
            error: FAILURE,
        })
        await expect(bare.service.scopeOf(STEP, FLOW, input({ leadId: "l1" }))).resolves.toMatchObject({ memory: null })
    })
})

/** The node step over the fixture graph (or `document`), with the step memory double unless `withMemory` is false. */
const buildStep = async (
    document: GraphDocument = { nodes: [], rights: [], flow: NODE_STEP_FLOW },
    withMemory = true,
) => {
    const host = mock<GraphNodeHostService>()
    const memory = mock<AgentGraphStepMemoryService>({
        recalled: jest.fn().mockResolvedValue(null),
        scopeOf: jest.fn().mockResolvedValue({ trigger: {}, steps: {}, namespace: "sales.main", memory: null }),
        bind: jest.fn().mockReturnValue({ params: { n: 2 }, input: { address: ADDRESS } }),
        remember: jest.fn().mockResolvedValue(undefined),
    })
    const graphs = mock<AgentGraphsService>({
        documentOf: jest.fn().mockResolvedValue(document),
        runGrantOf: jest.fn().mockResolvedValue(ownRunGrantOf(document.flow?.grant ?? EMPTY_GRANT)),
    })
    const flows = mock<AgentGraphFlowRunsService>({
        stepOf: jest.fn((node: GraphSpecNode, given: GraphNodeStepInput): StepSpec => ({
            stepKey: node.key,
            nodeKey: node.key,
            kind: "graph_node",
            effect: { kind: "read" },
            input: { ...given },
        })),
    })
    const notices = mock<AgentGraphRunNoticesService>({ stuck: jest.fn().mockResolvedValue(undefined) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphNodeStepService,
            { provide: AgentRunHandlersService, useValue: mock<AgentRunHandlersService>() },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: GraphNodeHostService, useValue: host },
            { provide: AgentGraphFlowRunsService, useValue: flows },
            {
                provide: GraphNodeRegistryService,
                useValue: mock<GraphNodeRegistryService>({
                    installed: jest.fn().mockReturnValue({ nodes: new Map() }),
                }),
            },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>() },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            {
                provide: AgentTagService,
                useValue: mock<AgentTagService>({ release: jest.fn().mockResolvedValue(undefined) }),
            },
            { provide: AgentGraphRunNoticesService, useValue: notices },
            ...(withMemory ? [{ provide: AgentGraphStepMemoryService, useValue: memory }] : []),
        ],
    }).compile()
    return { steps: moduleRef.get(AgentGraphNodeStepService), host, memory, notices }
}

const OUTCOME_FLOW: GraphDocument = {
    nodes: [],
    rights: [],
    flow: {
        ...NODE_STEP_FLOW,
        nodes: [
            { key: "won", kind: "output", step: "core.outcome", next: "keep" },
            ...NODE_STEP_FLOW.nodes.map((node) =>
                node.key === "keep" ? { ...node, params: { n: { $ref: "out.count" } }, input: {} } : node,
            ),
        ],
    },
}

describe("AgentGraphNodeStepService over the lead memory: binding and resume", () => {
    it("without the lead memory still reads out.* from the last outcome step of the run", async () => {
        const { steps, host } = await buildStep(OUTCOME_FLOW, false)
        host.run.mockResolvedValue({ output: {}, effects: [] })
        await steps.run(nodeStepOf("keep", { earlier: { won: { output: { outcome: "won", values: { count: 3 } } } } }))
        expect(host.run).toHaveBeenCalledWith(expect.objectContaining({ params: { n: 3 } }))
    })

    it("runs the node with the params and input the memory bound, and keeps its outcome", async () => {
        const { steps, host, memory } = await buildStep()
        host.run.mockResolvedValue({ output: { done: true }, effects: [] })
        await expect(steps.run(nodeStepOf("keep"))).resolves.toMatchObject({ kind: "done", next: [{ stepKey: "end" }] })
        expect(host.run).toHaveBeenCalledWith(
            expect.objectContaining({ params: { n: 2 }, input: { address: ADDRESS } }),
        )
        expect(memory.remember.mock.calls.at(0)?.[4]).toEqual({ status: "done", output: { done: true }, error: null })
    })

    it("never runs again a node whose outcome memory already holds for this run (no AI call on resume)", async () => {
        const { steps, host, memory } = await buildStep()
        memory.recalled.mockResolvedValue({ ...DONE, output: { done: "before" } })
        await expect(steps.run(nodeStepOf("keep"))).resolves.toMatchObject({
            kind: "done",
            result: { output: { done: "before" }, effects: [] },
            next: [{ stepKey: "end" }],
        })
        expect(host.run).not.toHaveBeenCalled()
    })
})

describe("AgentGraphNodeStepService over the lead memory: business failures", () => {
    it("stops the step on a business failure under the failure's own code, tells the team, and keeps no outcome a resume would return", async () => {
        const { steps, host, memory, notices } = await buildStep()
        host.run.mockRejectedValue(new NodeBusinessFailure(FAILURE))
        await expect(steps.run(nodeStepOf("keep"))).resolves.toEqual({ kind: "failed", code: FAILURE.code })
        expect(notices.stuck).toHaveBeenCalledWith(
            expect.objectContaining({ code: FAILURE.code }),
            expect.objectContaining({ report: null, customerLine: null }),
        )
        expect(memory.remember).not.toHaveBeenCalled()
    })
})
