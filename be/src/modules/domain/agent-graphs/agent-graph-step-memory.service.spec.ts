import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { coreNodes } from "@nivo-lite/blocks-core"
import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import type { LeadMemorySnapshot, MemoryWrite } from "@nivo-lite/agent-sdk/node"
import { stepViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { LeadMemoryService } from "@modules/domain/lead-memory"
import { CLOCK } from "@modules/platform/clock"
import { AgentGraphStepMemoryService, failureOfResult, stepsOfRun } from "./agent-graph-step-memory.service"
import type { GraphNodeStepInput } from "./policies/graph-flow.policy"

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

    it("keys the outcome of a for-each body step by its node, the latest iteration winning, and keeps memory per iteration", async () => {
        const looped = stepViewOf({
            runId: "run-1",
            stepKey: "after",
            nodeKey: "after",
            earlier: {
                "ship[0]": { output: { orderId: "o0" }, effects: [] },
                "ship[1]": { output: { orderId: "o1" }, effects: [] },
            },
        })
        const steps = stepsOfRun(looped, "v1")
        expect(Object.keys(steps)).toEqual(["ship"])
        expect(steps["ship"]).toMatchObject({ status: "done", output: { orderId: "o1" } })
        const { service } = await build()
        expect(service.memoryKeyOf(input({}))).toBe("order")
        expect(service.memoryKeyOf(input({}, { item: { value: "a", index: 2 } }))).toBe("order[2]")
    })

    it("without the lead memory still reads out.* from the last outcome step of the run, and no memory", async () => {
        const { service, memory } = await build(false)
        const scope = await service.scopeOf(STEP, FLOW, input({ leadId: "l1" }))
        expect(scope).toMatchObject({ out: { items: ["rose"] }, memory: null })
        expect(memory.snapshot).not.toHaveBeenCalled()
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
