import { DEFAULT_MODEL } from "@nivo-lite/agent-sdk/models"
import type { AgentStepUsage } from "@modules/domain/ai-usage-events"
import { INSTALLED } from "@modules/domain/installed-plugins"
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
        { key: "match", kind: "step", step: "sales.payment-short" },
        { key: "post", kind: "step", step: "sales.payment-remind", model: "claude-haiku-5-5" },
        { key: "start", kind: "trigger", step: "core.start" },
        { key: "mine", kind: "step", step: "shop.own-ai-step" },
    ],
})

describe("graphAiNodesOf", () => {
    it("lists the AI nodes with the model the engine would use (node > blocks-core > default) and their use over the window", () => {
        expect(INSTALLED.nodeModelOf("sales.payment-short")).not.toBeNull()
        const nodes = graphAiNodesOf(DRAFT, [
            MATCH_USAGE,
            { ...MATCH_USAGE, stepKey: "mine", runs: 1, credits: 2, creditsPerRun: 2 },
        ])

        expect(
            nodes.map((node) => [node.nodeKey, node.declaredModel, node.modelSource, node.runs, node.creditsPerRun]),
        ).toEqual([
            ["match", INSTALLED.nodeModelOf("sales.payment-short")?.model, "declared", 4, 5],
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
