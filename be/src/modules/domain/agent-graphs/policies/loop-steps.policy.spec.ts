import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import type { StepSpec } from "@modules/domain/agent-runs"
import { AgentGraphFlowRunsService } from "../agent-graph-flow-runs.service"
import { LoopStepsPolicy } from "./loop-steps.policy"
import type { GraphNodeStepInput } from "./graph-flow.policy"

const LOOP: GraphSpecNode = {
    key: "each",
    kind: "execute",
    step: "core.for-each",
    routes: { body: "say" },
    next: "end",
}
const SAY: GraphSpecNode = { key: "say", kind: "output", step: "core.reply" }

const FLOW: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "chatbot",
    trigger: { kind: "tag", sources: ["agent"] },
    grant: { rights: [], tools: [], effects: [] },
    nodes: [LOOP, SAY, { key: "end", kind: "output", step: "stop" }],
}

const INPUT: GraphNodeStepInput = { versionId: "v-1", nodeKey: "each", trigger: {} }

const build = async () => {
    const flows = mock<AgentGraphFlowRunsService>({
        stepOf: jest.fn((node: GraphSpecNode, input: GraphNodeStepInput): StepSpec => ({
            stepKey: node.key,
            nodeKey: node.key,
            kind: "graph_node",
            effect: { kind: "read" },
            input: { ...input },
        })),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: AgentGraphFlowRunsService, useValue: flows }],
    }).compile()
    return { loops: new LoopStepsPolicy(moduleRef.get(AgentGraphFlowRunsService)), flows }
}

describe("loop-steps.policy: LoopStepsPolicy", () => {
    it("starts the first iteration with the element in scope, and sums at once for an empty list or no body", async () => {
        const { loops } = await build()

        const first = loops.started(FLOW, LOOP, INPUT, ["a", "b"])
        expect(first).toMatchObject({
            kind: "iterate",
            step: {
                nodeKey: "say",
                input: { item: { value: "a", index: 0 }, loop: { nodeKey: "each", index: 0, items: ["a", "b"] } },
            },
        })
        expect(loops.started(FLOW, LOOP, INPUT, [])).toMatchObject({ kind: "summed", summary: { okCount: 0 } })
        expect(loops.started(FLOW, { ...LOOP, routes: {} }, INPUT, ["a"])).toMatchObject({ kind: "summed" })
    })

    it("joins an ended body on its loop, and nothing outside a loop or at the loop itself", async () => {
        const { loops } = await build()
        const frame = { nodeKey: "each", index: 1, items: ["a", "b"] }
        const body = { ...INPUT, nodeKey: "say", item: { value: "b", index: 1 }, loop: frame }

        expect(loops.ended(FLOW, body, { output: 7, error: null })).toMatchObject([
            { nodeKey: "each", input: { loop: frame, join: { index: 1, output: 7, error: null } } },
        ])
        expect(loops.ended(FLOW, INPUT, { output: 7, error: null })).toEqual([])
        expect(loops.ended(FLOW, { ...body, nodeKey: "each" }, { output: 7, error: null })).toEqual([])
    })

    it("goes to the next iteration after a join, and sums every iteration after the last", async () => {
        const { loops } = await build()
        const frame = { nodeKey: "each", index: 0, items: ["a", "b"] }
        const input = { ...INPUT, loop: frame }

        expect(loops.joined(FLOW, LOOP, input, { index: 0, output: 1, error: null }, {})).toMatchObject({
            kind: "iterate",
            step: { input: { item: { value: "b", index: 1 } } },
        })
        const earlier = { "each#0": { joined: { index: 0, output: 1, error: null } } }
        const last = loops.joined(
            FLOW,
            LOOP,
            input,
            { index: 1, output: null, error: { code: "x", message: "m" } },
            earlier,
        )
        expect(last).toMatchObject({
            kind: "summed",
            summary: { okCount: 1, failed: [{ index: 1, item: "b", error: { code: "x" } }] },
            outside: { versionId: "v-1", nodeKey: "each" },
        })
        expect(last.kind === "summed" ? last.outside : null).not.toHaveProperty("loop")
    })
})
