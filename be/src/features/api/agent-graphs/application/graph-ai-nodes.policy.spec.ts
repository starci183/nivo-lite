import { DEFAULT_MODEL, nodeModelOf } from "@nivo-lite/blocks-core"
import type { AgentStepUsage } from "@modules/domain/ai-usage-events"
import { graphAiNodesOf } from "./graph-ai-nodes.policy"

const MATCH_USAGE: AgentStepUsage = {
    stepKey: "match",
    runs: 4,
    calls: 5,
    failedTries: 1,
    costUsd: 0.0226,
    failedCostUsd: 0.004,
    credits: 20,
    creditsPerRun: 5,
    averageMs: 7_400,
    models: ["claude-sonnet-5-5"],
}

const DRAFT = JSON.stringify({
    nodes: [
        { key: "match", kind: "step", step: "accounting.match-payment" },
        { key: "post", kind: "step", step: "accounting.post-payment", model: "claude-haiku-5-5" },
        { key: "start", kind: "trigger", step: "core.start" },
        { key: "mine", kind: "step", step: "shop.own-ai-step" },
    ],
})

describe("graphAiNodesOf", () => {
    it("lists the AI nodes with the model the engine would use (node > blocks-core > default) and their use over the window", () => {
        expect(nodeModelOf("accounting.match-payment")).not.toBeNull()
        const nodes = graphAiNodesOf(DRAFT, [
            MATCH_USAGE,
            { ...MATCH_USAGE, stepKey: "mine", runs: 1, credits: 2, creditsPerRun: 2 },
        ])

        expect(
            nodes.map((node) => [node.nodeKey, node.declaredModel, node.modelSource, node.runs, node.creditsPerRun]),
        ).toEqual([
            ["match", nodeModelOf("accounting.match-payment")?.model, "declared", 4, 5],
            ["post", "claude-haiku-5-5", "node", 0, 0],
            ["mine", DEFAULT_MODEL, "default", 1, 2],
        ])
        expect(nodes[0]).toMatchObject({
            calls: 5,
            failedTries: 1,
            credits: 20,
            averageMs: 7_400,
            servedModels: ["claude-sonnet-5-5"],
        })
    })

    it("answers no node for a draft it cannot read", () => {
        expect(graphAiNodesOf("not json", [MATCH_USAGE])).toEqual([])
        expect(graphAiNodesOf(JSON.stringify({ nodes: "x" }), [])).toEqual([])
    })
})
