import {
    GRAPH_EDGES_MAX,
    GRAPH_NODES_MAX,
    GRAPH_NODE_KINDS,
    GRAPH_NODE_STATES,
    RUN_STEPS_MAX,
    graphView,
    runPathView,
} from "./graph-view"

const NODE = { id: "n1", label: "Nhan tin", kind: "trigger" }
const EDGE = { id: "e1", from: "n1", to: "n2" }
const accepts = (value: unknown): boolean => graphView.safeParse(value).success

describe("graphView", () => {
    it("takes nodes and edges, and keeps the fields it does not know", () => {
        const parsed = graphView.parse({ nodes: [{ ...NODE, rights: ["read"] }], edges: [EDGE], title: "Luong" })
        expect(parsed.nodes[0]).toMatchObject({ id: "n1", rights: ["read"] })
        expect(parsed.edges).toEqual([EDGE])
    })

    it("takes every kind and state of a node and an optional line, state and condition", () => {
        expect(GRAPH_NODE_KINDS.every((kind) => accepts({ nodes: [{ ...NODE, kind }], edges: [] }))).toBe(true)
        expect(GRAPH_NODE_STATES.every((state) => accepts({ nodes: [{ ...NODE, state }], edges: [] }))).toBe(true)
        expect(
            accepts({ nodes: [{ ...NODE, description: null, state: null }], edges: [{ ...EDGE, condition: null }] }),
        ).toBe(true)
        expect(accepts({ nodes: [{ ...NODE, description: "Mo ta" }], edges: [{ ...EDGE, condition: "co" }] })).toBe(
            true,
        )
    })

    it("refuses a missing list, an unknown kind or state, a missing id and an edge without ends", () => {
        expect(accepts({ nodes: [] })).toBe(false)
        expect(accepts({ edges: [] })).toBe(false)
        expect(accepts({ nodes: [{ ...NODE, kind: "html" }], edges: [] })).toBe(false)
        expect(accepts({ nodes: [{ ...NODE, state: "sleeping" }], edges: [] })).toBe(false)
        expect(accepts({ nodes: [{ ...NODE, id: "" }], edges: [] })).toBe(false)
        expect(accepts({ nodes: [], edges: [{ id: "e1", from: "n1" }] })).toBe(false)
    })

    it("refuses a graph past its bounds and text past its length", () => {
        expect(accepts({ nodes: Array.from({ length: GRAPH_NODES_MAX + 1 }, () => NODE), edges: [] })).toBe(false)
        expect(accepts({ nodes: [], edges: Array.from({ length: GRAPH_EDGES_MAX + 1 }, () => EDGE) })).toBe(false)
        expect(accepts({ nodes: [{ ...NODE, label: "x".repeat(201) }], edges: [] })).toBe(false)
    })
})

describe("runPathView", () => {
    it("takes the steps of a run and ignores the rest of the run", () => {
        const parsed = runPathView.parse({ id: "r1", steps: [{ node: "n1", state: "done", label: "Nhan tin" }] })
        expect(parsed.steps).toEqual([{ node: "n1", state: "done", label: "Nhan tin" }])
    })

    it("refuses a step without a node, with an unknown state, and too many steps", () => {
        expect(runPathView.safeParse({ steps: [{ state: "done" }] }).success).toBe(false)
        expect(runPathView.safeParse({ steps: [{ node: "n1", state: "idle" }] }).success).toBe(false)
        const many = Array.from({ length: RUN_STEPS_MAX + 1 }, () => ({ node: "n1", state: "done" }))
        expect(runPathView.safeParse({ steps: many }).success).toBe(false)
        expect(runPathView.safeParse({}).success).toBe(false)
    })
})
