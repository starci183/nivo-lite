import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import vi from "../../messages/vi.json"
import { latestTemplateVersion, workflowTemplateOf } from "../../modules/workflow-templates"
import { graphViewOfSpec } from "../../rows/graph-spec-view"
import type { GraphNodeView, GraphView } from "../../rows/graph-view"
import { STEP_ICONS, stepsFlowOf, stepsLegendOf, stepsStatusLabelsOf } from "./steps-flow"

/** The graph a template ships now. */
const graphOf = (id: string): GraphSpec => {
    const template = workflowTemplateOf(id)
    if (template === null) throw new Error(`no template ${id}`)
    return latestTemplateVersion(template).graph
}

const GRAPHS: ReadonlyArray<readonly [string, GraphSpec]> = [
    ["accounting", graphOf("accounting.reconcile")],
    ["chatbot", graphOf("chatbot.front-desk")],
    ["sales", graphOf("sales.consult")],
]

describe.each(GRAPHS)("stepsFlowOf of the %s graph", (_name, spec) => {
    const view = graphViewOfSpec(spec, { locale: "vi", withTrigger: true })
    const flow = stepsFlowOf(view, "vi")

    it("draws every node as a step card with a kind, words and no raw node key", () => {
        expect(flow.nodes.map((node) => node.id)).toEqual(view.nodes.map((node) => node.id))
        for (const node of flow.nodes) {
            expect(["event", "action", "condition", "wait", "end"]).toContain(node.kind)
            expect([node.id, node.label === node.id]).toEqual([node.id, false])
        }
        expect(flow.nodes[0]?.tag).toBe(vi.graphTagTrigger)
    })

    it("leaves a condition from the port its words name, and keeps a back edge dashed", () => {
        for (const edge of flow.edges) {
            const source = flow.nodes.find((node) => node.id === edge.source)
            if (edge.variant === "back") expect(edge.label).toBeTruthy()
            else if (source?.kind === "condition") expect(edge.sourcePort).toBeTruthy()
            else expect(edge.sourcePort).toBeUndefined()
        }
    })
})

describe("stepsFlowOf", () => {
    it("draws the end with its outcome words and a step with the glyph its card names", () => {
        const view = graphViewOfSpec(graphOf("sales.consult"), { locale: "vi" })
        const flow = stepsFlowOf(view, "vi")
        const of = (id: string) => flow.nodes.find((node) => node.id === id)

        const end = flow.nodes.find((node) => node.kind === "end")
        const outcome = view.nodes.find((node) => node.id === end?.id)?.outcome
        expect(end?.label).toBe(outcome?.label ?? vi.graphStepEnd)
        expect(of("send-qr")).toMatchObject({ kind: "action", icon: STEP_ICONS.qr })
    })

    it("names the legend and the run statuses in the language asked", () => {
        expect(stepsLegendOf("vi").map((item) => item.label)).toEqual([
            vi.graphKindEvent,
            vi.graphKindAction,
            vi.graphKindCondition,
            vi.graphKindWait,
        ])
        expect(stepsStatusLabelsOf("en").running).toBe("Running")
    })
})

describe("stepsFlowOf chips and failure ports", () => {
    const node = (id: string, params: Readonly<Record<string, unknown>>): GraphNodeView => ({
        id,
        label: id,
        kind: "step",
        params,
        paramFields: Object.keys(params).map((name) => ({
            name,
            label: name,
            help: "",
            input: "text",
            hidden: false,
            required: false,
        })),
    })
    const flowOf = (nodes: ReadonlyArray<GraphNodeView>, edges: GraphView["edges"] = []) =>
        stepsFlowOf({ nodes, edges }, "vi")

    it("draws a bound param as an accent chip and a fixed one as a neutral chip", () => {
        const flow = flowOf([node("a", { orderId: { $ref: "steps.order.output.id" }, note: "hello" })])
        expect(flow.nodes[0]?.chips).toEqual([
            { label: "= order.id", tone: "accent" },
            { label: "note: hello", tone: "neutral" },
        ])
    })

    it("hands over every chip of a step and leaves a step without params with none", () => {
        const flow = flowOf([node("a", { p1: 1, p2: 2, p3: 3, p4: 4 }), node("b", {})])
        expect(flow.nodes[0]?.chips).toHaveLength(4)
        expect(flow.nodes[1]?.chips).toBeUndefined()
    })

    it("draws a for-each step as a loop card around its body, with the list it walks as a chip", () => {
        const loop: GraphNodeView = {
            ...node("each", {}),
            loop: { items: { name: "items", label: "items", kind: "ref", text: "= order.items", ref: "order.items", fallback: null }, max: 50, bodyKeys: ["b"] },
        }
        const flow = flowOf([loop, node("b", {})])
        expect(flow.nodes[0]?.container).toEqual({
            label: "each",
            chips: [{ label: "= order.items", tone: "accent" }],
            childIds: ["b"],
        })
        expect(flow.nodes[1]?.container).toBeUndefined()
    })

    it("draws an end step with its outcome words, and the main outcome in the accent tone", () => {
        const end = (id: string, key: string, label: string): GraphNodeView => ({
            ...node(id, {}),
            kind: "end",
            outcome: { key, label, bindings: [] },
        })
        const view: GraphView = {
            nodes: [end("a", "won", "Won"), end("b", "lost", "Lost")],
            edges: [],
            outcomes: [
                { key: "won", label: "Won", outputs: [] },
                { key: "lost", label: "Lost", outputs: [] },
            ],
        }
        const flow = stepsFlowOf(view, "vi")
        expect(flow.nodes[0]).toMatchObject({ label: "Won", kind: "end", tone: "accent" })
        expect(flow.nodes[1]).toMatchObject({ label: "Lost", kind: "end" })
        expect(flow.nodes[1]?.tone).toBeUndefined()
    })
})
