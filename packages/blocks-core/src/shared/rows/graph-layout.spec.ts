import { EMPTY_FLOW, graphFlowOf, runPathOf } from "./graph-layout"
import type { GraphView } from "./graph-view"

const WORDS = (state: string): string => `state:${state}`

const GRAPH: GraphView = {
    nodes: [
        { id: "start", label: "Nhan tin", kind: "trigger" },
        { id: "check", label: "Du hang", kind: "condition", description: "Kiem kho" },
        { id: "wait", label: "Cho duyet", kind: "wait" },
        { id: "send", label: "Gui bao gia", kind: "step", state: "done" },
        { id: "end", label: "Xong", kind: "output", state: "idle" },
    ],
    edges: [
        { id: "e1", from: "start", to: "check" },
        { id: "e2", from: "check", to: "wait", condition: "het hang" },
        { id: "e3", from: "check", to: "send", condition: "" },
        { id: "e4", from: "send", to: "end", condition: null },
    ],
}

describe("graphFlowOf", () => {
    it("draws the nodes in graph order with the Grammar kind, a wait as a cautionary round step", () => {
        const flow = graphFlowOf(GRAPH, null, WORDS)
        expect(flow?.nodes.map((node) => [node.id, node.kind])).toEqual([
            ["start", "trigger"],
            ["check", "condition"],
            ["wait", "execute"],
            ["send", "execute"],
            ["end", "output"],
        ])
        expect(flow?.nodes[2]).toEqual({
            id: "wait",
            label: "Cho duyet",
            kind: "execute",
            tone: "warning",
            shape: "round",
        })
    })

    it("tells the state a graph carries and leaves an idle node plain", () => {
        const flow = graphFlowOf(GRAPH, null, WORDS)
        expect(flow?.nodes[3]).toEqual({
            id: "send",
            label: "Gui bao gia",
            kind: "execute",
            description: "state:done",
            tone: "success",
        })
        expect(flow?.nodes[4]).toEqual({ id: "end", label: "Xong", kind: "output" })
        expect(flow?.nodes[1]).toMatchObject({ description: "Kiem kho" })
        expect(flow?.nodes.some((node) => node.isDimmed === true)).toBe(false)
    })

    it("leaves a node plain whose state is absent or null", () => {
        const graph: GraphView = {
            nodes: [
                { id: "a", label: "A", kind: "step" },
                { id: "b", label: "B", kind: "step", state: null },
            ],
            edges: [],
        }
        expect(graphFlowOf(graph, null, WORDS)?.nodes).toEqual([
            { id: "a", label: "A", kind: "execute" },
            { id: "b", label: "B", kind: "execute" },
        ])
    })

    it("puts the state before the node's own line", () => {
        const graph: GraphView = {
            nodes: [{ id: "a", label: "A", kind: "step", state: "failed", description: "Loi" }],
            edges: [],
        }
        expect(graphFlowOf(graph, null, WORDS)?.nodes[0]).toMatchObject({
            description: "state:failed \u00b7 Loi",
            tone: "danger",
        })
    })

    it("carries a condition as the label of its edge and none for an empty or absent one", () => {
        const flow = graphFlowOf(GRAPH, null, WORDS)
        expect(flow?.edges).toEqual([
            { id: "e1", source: "start", target: "check" },
            { id: "e2", source: "check", target: "wait", label: "het hang" },
            { id: "e3", source: "check", target: "send" },
            { id: "e4", source: "send", target: "end" },
        ])
    })

    it("draws a chosen run's states and dims the nodes the run never reached", () => {
        const path = {
            steps: [
                { node: "start", state: "done" as const },
                { node: "check", state: "done" as const },
                { node: "wait", state: "waiting" as const },
            ],
        }
        const flow = graphFlowOf(GRAPH, path, WORDS)
        expect(flow?.nodes.map((node) => node.isDimmed === true)).toEqual([false, false, false, true, true])
        expect(flow?.nodes[2]).toMatchObject({ description: "state:waiting", tone: "warning", shape: "round" })
        expect(flow?.nodes[3]).toEqual({ id: "send", label: "Gui bao gia", kind: "execute", isDimmed: true })
    })

    it("keeps the last state of a node a run visited twice", () => {
        const path = {
            steps: [
                { node: "send", state: "failed" as const },
                { node: "send", state: "done" as const },
            ],
        }
        expect(graphFlowOf(GRAPH, path, WORDS)?.nodes[3]).toMatchObject({ tone: "success" })
    })

    it("keeps the first of a repeated node or edge id and drops an edge to a node it does not hold", () => {
        const graph: GraphView = {
            nodes: [
                { id: "a", label: "A", kind: "step" },
                { id: "a", label: "Again", kind: "step" },
                { id: "b", label: "B", kind: "step" },
            ],
            edges: [
                { id: "e1", from: "a", to: "b" },
                { id: "e1", from: "b", to: "a" },
                { id: "e2", from: "a", to: "ghost" },
                { id: "e3", from: "ghost", to: "b" },
            ],
        }
        const flow = graphFlowOf(graph, null, WORDS)
        expect(flow?.nodes.map((node) => node.label)).toEqual(["A", "B"])
        expect(flow?.edges).toEqual([{ id: "e1", source: "a", target: "b" }])
    })

    it("is null for a graph with no node, which the block reads as empty", () => {
        expect(graphFlowOf({ nodes: [], edges: [] }, null, WORDS)).toBeNull()
        expect(EMPTY_FLOW).toEqual({ nodes: [], edges: [] })
    })
})

describe("runPathOf", () => {
    const run = { id: "r1", steps: [{ node: "start", state: "done" }] }

    it("reads the steps of the chosen run from a ready slot", () => {
        expect(runPathOf({ items: run }, "r1")).toMatchObject({ steps: [{ node: "start", state: "done" }] })
    })

    it("is none while no run is chosen", () => {
        expect(runPathOf({ items: run }, null)).toBeNull()
    })

    it("is none while the read has not answered, is empty, failed or forbidden", () => {
        expect(runPathOf({ isLoading: true }, "r1")).toBeNull()
        expect(runPathOf({ isEmpty: true }, "r1")).toBeNull()
        expect(runPathOf({ isError: true }, "r1")).toBeNull()
        expect(runPathOf({ isForbidden: true }, "r1")).toBeNull()
    })

    it("is none for data that is no run", () => {
        expect(runPathOf({ items: { steps: "x" } }, "r1")).toBeNull()
    })
})
