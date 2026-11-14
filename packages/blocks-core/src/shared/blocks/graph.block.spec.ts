import { GRAPH_FIXTURE, graphFixtureProps, graphFixtures, graphRunPathFixtures } from "../fixtures/graph.fixtures"
import { graphFlowOf, runPathOf } from "../rows/graph-layout"
import { graphView } from "../rows/graph-view"
import { graphBlock } from "./graph.block"

const WORD = { key: "word" }
const accepts = (props: unknown): boolean => graphBlock.props.safeParse(props).success

describe("graphBlock", () => {
    it("is the core.graph block, with no children", () => {
        expect(graphBlock.id).toBe("core.graph")
        expect(graphBlock.children).toBe(false)
        expect(Object.keys(graphBlock.propsJson).length).toBeGreaterThan(0)
    })

    it("lists selectParam and runParam as the props that name a spec param", () => {
        expect(graphBlock.params).toEqual(["selectParam", "runParam"])
    })

    it("names a required graph read and an optional path read, both of one record", () => {
        expect(graphBlock.slots).toEqual({
            graph: { kind: "read", shape: "record", required: true },
            path: { kind: "read", shape: "record", required: false },
        })
    })

    it("takes a label, with the empty words and the two params optional", () => {
        expect(accepts({ label: WORD })).toBe(true)
        expect(accepts({ label: WORD, empty: WORD, selectParam: "node", runParam: "run" })).toBe(true)
        expect(accepts(graphFixtureProps)).toBe(true)
    })

    it("refuses a missing label, a param name that is no word and an unknown prop value", () => {
        expect(accepts({})).toBe(false)
        expect(accepts({ label: WORD, selectParam: "9lives" })).toBe(false)
        expect(accepts({ label: WORD, runParam: "a b" })).toBe(false)
        expect(accepts({ label: WORD, selectParam: "p".repeat(65) })).toBe(false)
    })
})

describe("graphFixtures", () => {
    it("holds a ready graph the block draws, and every other status", () => {
        expect(Object.keys(graphFixtures)).toEqual(["ready", "empty", "error", "loading", "forbidden"])
        const ready = graphFixtures.ready
        const graph = "items" in ready ? graphView.parse(ready.items) : null
        expect(graph).not.toBeNull()
        const flow = graph === null ? null : graphFlowOf(graph, null, String)
        expect(flow?.nodes.length).toBe(graph?.nodes.length)
        expect(flow?.edges.length).toBe(graph?.edges.length)
    })

    it("holds a run waiting for approval, a parked run and a finished one, each reaching nodes of the graph", () => {
        expect(Object.keys(graphRunPathFixtures)).toEqual(["waiting", "parked", "done"])
        const ids = GRAPH_FIXTURE.nodes.map((node) => node.id)
        const paths = [graphRunPathFixtures.waiting, graphRunPathFixtures.parked, graphRunPathFixtures.done]
        paths.forEach((slot) => {
            const path = runPathOf(slot, "r1")
            expect(path?.steps.length).toBeGreaterThan(0)
            expect(path?.steps.every((step) => ids.includes(step.node))).toBe(true)
        })
        expect(runPathOf(graphRunPathFixtures.waiting, "r1")?.steps.at(-1)?.state).toBe("waiting")
        expect(runPathOf(graphRunPathFixtures.parked, "r1")?.steps.at(-1)?.state).toBe("parked")
    })
})
