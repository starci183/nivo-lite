import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { AgentGraphsErrorCode } from "../errors/agent-graphs.error"
import { graphWithNodeMode } from "./node-mode-override.policy"

const GRAPH: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["agent"] },
    grant: { tools: [], effects: [] },
    nodes: [
        { key: "consult", kind: "execute", step: "sales.consult-turn", mode: "auto", next: "hand" },
        { key: "hand", kind: "execute", step: "core.call-workflow", next: "end" },
        { key: "end", kind: "output", step: "stop" },
    ],
}

const isControl = (step: string): boolean => step === "core.call-workflow"

describe("node-mode-override.policy: one node's mode on the shop's graph copy", () => {
    it("replaces only that node's mode; every other node and member stays as it runs", () => {
        const changed = graphWithNodeMode(GRAPH, "consult", "ask", isControl)

        expect(changed).toEqual({ ...GRAPH, nodes: [{ ...GRAPH.nodes[0], mode: "ask" }, GRAPH.nodes[1], GRAPH.nodes[2]] })
        expect(GRAPH.nodes[0]).toMatchObject({ mode: "auto" })
    })

    it("answers null for a node already in that mode (nothing to write)", () => {
        expect(graphWithNodeMode(GRAPH, "consult", "auto", isControl)).toBeNull()
    })

    it("refuses, typed, a key no node has and an engine control step (it declares no mode)", () => {
        expect(() => graphWithNodeMode(GRAPH, "gone", "ask", isControl)).toThrow(
            expect.objectContaining({ code: AgentGraphsErrorCode.WorkflowRefused, params: { reason: "node" } }),
        )
        expect(() => graphWithNodeMode(GRAPH, "hand", "ask", isControl)).toThrow(
            expect.objectContaining({ code: AgentGraphsErrorCode.WorkflowRefused, params: { reason: "node-control" } }),
        )
    })
})
