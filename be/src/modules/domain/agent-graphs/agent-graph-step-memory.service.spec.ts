import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { defineNode, type LeadMemorySnapshot, type MemoryWrite, type NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { stepViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { noteNode } from "@tests/fixtures/builders/template-plugin.builder"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { LeadMemoryService } from "@modules/domain/lead-memory"
import { CLOCK } from "@modules/platform/clock"
import { AgentGraphStepMemoryService, failureOfResult, stepsOfRun } from "./agent-graph-step-memory.service"
import type { GraphNodeStepInput } from "./policies/graph-flow.policy"

const NOW = Date.parse("2026-11-09T10:00:00.000Z")
const ADDRESS = "335 Ba Trieu"
const ORDER_STEP = "spec.create-order"

/** The lead facts the order step of this spec proves by its output: no shipped node declares any, the engine still writes them. */
const ORDER_FACTS = { address: "address", lastOrderId: "orderId" } as const

/**
 * The spec's own `defineNode` order step, with the input of the order step the core package shipped before the flip (`leadId`,
 * `address`). Since the flip every shipped business step is a template node (bound by the node host, not here), so the `defineNode`
 * road this service still binds by the node's schemas is proved on a node of the spec's own.
 */
const ORDER_DEFINITION: NodeDefinition = defineNode({
    id: ORDER_STEP,
    role: "output",
    title: { vi: "T\u1ea1o \u0111\u01a1n", en: "Create the order" },
    params: z.object({}),
    input: z.object({ leadId: z.string().max(64), address: z.string().max(200) }),
    output: z.object({ orderId: z.string().max(64), address: z.string().max(200) }),
    effects: [],
    facts: ORDER_FACTS,
    run: (given) => Promise.resolve({ orderId: "o1", address: given.address }),
    examples: [
        { name: "one", params: {}, input: { leadId: "l1", address: ADDRESS }, output: { orderId: "o1", address: ADDRESS }, effects: [] },
    ],
})

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
    grant: { tools: [], effects: [] },
    nodes: [{ key: "won", kind: "output", step: "core.outcome", next: "order" }, ORDER_NODE],
}

const SNAPSHOT: LeadMemorySnapshot = {
    subject: { key: "contact:l1", contactId: "l1", conversationId: "c1" },
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

/** The step memory service over the spec's order node (declaring `ORDER_FACTS`), with the lead memory double unless `withMemory` is false. */
const build = async (withMemory: boolean = true) => {
    const nodes = mock<GraphNodeRegistryService>({
        installed: jest.fn().mockReturnValue({ nodes: new Map([[ORDER_STEP, ORDER_DEFINITION]]) }),
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
        const scope = await service.scopeOf(STEP, FLOW, input({ leadId: "l1", contactId: "l1", conversationId: "c1" }))
        expect(memory.snapshot).toHaveBeenCalledWith(STEP.workspaceId, SNAPSHOT.subject, "step")
        expect(scope.out).toEqual({ items: ["rose"] })
        expect(scope.namespace).toBe("sales.consult")
        expect(service.bind(ORDER_NODE, scope)).toEqual({ params: {}, input: { leadId: "l1", address: ADDRESS } })
    })

    it("keys the outcome of a for-each body step by its node, the latest item winning after the loop, and keeps memory per item", async () => {
        const looped = stepViewOf({
            runId: "run-1",
            stepKey: "after",
            nodeKey: "after",
            earlier: {
                "each[o0].ship": { output: { orderId: "o0" }, effects: [] },
                "each[o1].ship": { output: { orderId: "o1" }, effects: [] },
            },
        })
        const steps = stepsOfRun(looped, "v1")
        expect(Object.keys(steps)).toEqual(["ship"])
        expect(steps["ship"]).toMatchObject({ status: "done", output: { orderId: "o1" } })
        const { service } = await build()
        expect(service.memoryKeyOf(input({}))).toBe("order")
        expect(
            service.memoryKeyOf(input({}, { item: { value: "a", index: 2, key: "a-1" }, loop: { nodeKey: "each", index: 2, items: [] } })),
        ).toBe("each[a-1].order")
    })

    it("inside an item sees only that item's own body steps: another item's step is never read as this one's", () => {
        const looped = stepViewOf({
            runId: "run-1",
            stepKey: "each[o2].record",
            nodeKey: "record",
            earlier: {
                list: { output: { orders: [] }, effects: [] },
                "each[o1].ship": { output: { orderId: "o1" }, effects: [] },
                "each[o1].record": { output: { kept: "o1" }, effects: [] },
                "each[o2].ship": { output: { orderId: "o2" }, effects: [] },
            },
        })
        const inItem = { item: { value: null, index: 1, key: "o2" }, loop: { nodeKey: "each", index: 1, items: [] } }
        const steps = stepsOfRun(looped, "v1", inItem)
        expect(Object.keys(steps).sort()).toEqual(["list", "ship"])
        expect(steps["ship"]).toMatchObject({ output: { orderId: "o2" } })
    })

    it("without the lead memory still reads out.* from the last outcome step of the run, and no memory", async () => {
        const { service, memory } = await build(false)
        const scope = await service.scopeOf(STEP, FLOW, input({ leadId: "l1", contactId: "l1" }))
        expect(scope).toMatchObject({ out: { items: ["rose"] }, memory: null })
        expect(memory.snapshot).not.toHaveBeenCalled()
    })
})

describe("AgentGraphStepMemoryService: the writes", () => {
    it("keeps an outcome with the facts the node proves, and moves a conversation's memory to the contact the step named", async () => {
        const { service, memory } = await build()
        const output = { orderId: "o1", address: ADDRESS, contactId: "l9" }
        await service.remember(STEP, FLOW, ORDER_NODE, input({ conversationId: "c1" }), {
            status: "done",
            output,
            error: null,
        })
        expect(memory.adopt).toHaveBeenCalledWith(STEP.workspaceId, "c1", "l9")
        expect(writtenOf(memory)).toMatchObject({
            subject: { key: "contact:l9", contactId: "l9", conversationId: "c1" },
            namespace: "sales.consult",
            workflowId: "wf-1",
            nodeKey: "order",
            facts: { address: ADDRESS, lastOrderId: "o1" },
            outcome: { status: "done", runId: "run-1", versionId: "v1", at: "2026-11-09T10:00:00.000Z" },
        })
    })

    it("keeps the facts a TEMPLATE node declares, read like a defineNode node's (the registry holds no template node)", async () => {
        const template = { ...noteNode, facts: { address: "where", lastOrderId: "order.id" } }
        const spy = jest.spyOn(INSTALLED, "templateNodeOf").mockImplementation((id) => (id === template.id ? template : null))
        const { service, memory } = await build()
        const node: GraphSpecNode = { key: "note", kind: "execute", step: template.id }
        await service.remember(STEP, FLOW, node, input({ leadId: "l1", contactId: "l1" }), {
            status: "done",
            output: { where: ADDRESS, order: { id: "o7" } },
            error: null,
        })
        expect(writtenOf(memory)).toMatchObject({ step: template.id, facts: { address: ADDRESS, lastOrderId: "o7" } })
        spy.mockRestore()
    })

    it("writes no fact for a failure, and nothing at all without the memory capability", async () => {
        const { service, memory } = await build()
        await service.remember(STEP, FLOW, ORDER_NODE, input({ leadId: "l1", contactId: "l1" }), {
            status: "failed",
            output: null,
            error: FAILURE,
        })
        expect(writtenOf(memory)).toMatchObject({ facts: {} })
        const bare = await build(false)
        await bare.service.remember(STEP, FLOW, ORDER_NODE, input({ leadId: "l1", contactId: "l1" }), {
            status: "failed",
            output: null,
            error: FAILURE,
        })
        await expect(bare.service.scopeOf(STEP, FLOW, input({ leadId: "l1", contactId: "l1" }))).resolves.toMatchObject({ memory: null })
    })
})
