import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import vi from "../../messages/vi.json"
import { latestTemplateVersion, parseWorkflowTemplate, type WorkflowTemplate } from "@nivo-lite/agent-sdk/template"
import consult from "../../rows/legacy-templates/consult.template.json"
import frontDesk from "../../rows/legacy-templates/front-desk.template.json"
import reconcile from "../../rows/legacy-templates/reconcile.template.json"
import { graphViewOfSpec } from "../../rows/graph-spec-view"
import type { GraphNodeView, GraphView } from "../../rows/graph-view"
import { STEP_ICONS, stepsFlowOf, stepsLegendOf, stepsStatusLabelsOf } from "./steps-flow"

/**
 * The last JSON templates of the front desk, the consult and the reconciliation, kept as data for the views of an @1 graph spec (the
 * agents' graphs are `nivo/agent-graph@2` since the flip; the back end reads them into @1 for these views).
 */
const LEGACY_TEMPLATES: ReadonlyArray<WorkflowTemplate> = [frontDesk, consult, reconcile].map((raw) => parseWorkflowTemplate(raw))
const workflowTemplateOf = (id: string): WorkflowTemplate | null => LEGACY_TEMPLATES.find((one) => one.id === id) ?? null

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

const ORDER_ID_CHIP = "= order.id"
const NOTE_CHIP = "note: hello"
const ORDER_ITEMS_CHIP = "= order.items"
const WON = "Won"
const LOST = "Lost"

describe("stepsFlowOf", () => {
    it("draws the end with its outcome words and a step with the glyph its card names", () => {
        const view = graphViewOfSpec(graphOf("sales.consult"), { locale: "vi" })
        const flow = stepsFlowOf(view, "vi")
        const of = (id: string) => flow.nodes.find((node) => node.id === id)

        const end = flow.nodes.find((node) => node.kind === "end")
        const outcome = view.nodes.find((node) => node.id === end?.id)?.outcome
        expect(end?.label).toBe(outcome?.label ?? vi.graphStepEnd)
        expect(of("consult")).toMatchObject({ kind: "action", icon: STEP_ICONS.message })
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
            { label: ORDER_ID_CHIP, tone: "accent" },
            { label: NOTE_CHIP, tone: "neutral" },
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
            loop: { items: { name: "items", label: "items", kind: "ref", text: ORDER_ITEMS_CHIP, ref: "order.items", fallback: null }, max: 50, bodyKeys: ["b"] },
        }
        const flow = flowOf([loop, node("b", {})])
        expect(flow.nodes[0]?.container).toEqual({
            label: "each",
            chips: [{ label: ORDER_ITEMS_CHIP, tone: "accent" }],
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
            nodes: [end("a", "won", WON), end("b", "lost", LOST)],
            edges: [],
            outcomes: [
                { key: "won", label: WON, outputs: [] },
                { key: "lost", label: LOST, outputs: [] },
            ],
        }
        const flow = stepsFlowOf(view, "vi")
        expect(flow.nodes[0]).toMatchObject({ label: WON, kind: "end", tone: "accent" })
        expect(flow.nodes[1]).toMatchObject({ label: LOST, kind: "end" })
        expect(flow.nodes[1]?.tone).toBeUndefined()
    })
})
