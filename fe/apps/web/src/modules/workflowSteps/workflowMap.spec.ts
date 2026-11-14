import { graphSpecSchema } from "@nivo-lite/agent-sdk/graph"
import { graphViewOfSpec } from "@nivo-lite/blocks-core/graph"
import { stepsFlowOf, stepsLegendOf } from "@nivo-lite/blocks-core/client"
import sale from "./__fixtures__/sale-consult.v1.json"
import { dressedGraphOf, framedFlowOf, legendOf } from "./workflowMap"
import { mapWordsOf } from "./workflowMap.words"

/**
 * The real `sales.consult` graph (version 30, the slim graph), read as the engine's graph (the back end's @2 -> @1 adapter wrote the fixture
 * from the template): 35 steps, two `until` loops (talk, pay), two waits (hear, await), seven conditions, two hand-backs, five outcomes.
 * Every condition, wait, loop, hand-back and outcome carries the graph's own words.
 */
const spec = graphSpecSchema.parse(sale)

/** The words of a written text in one language (the fixture writes both; a catalogue key reads as itself). */
type Written = NonNullable<(typeof spec.nodes)[number]["label"]>
const textOf = (text: Written | undefined, locale: "vi" | "en"): string | undefined =>
    text === undefined ? undefined : "key" in text ? text.key : text[locale]

/** The graph's own words of a step's label, by key and language. */
const labelOf = (key: string, locale: "vi" | "en"): string | undefined => textOf(spec.nodes.find((node) => node.key === key)?.label, locale)

/** The graph's own words of a loop's way out. */
const exitOf = (key: string, exit: "until" | "exhausted", locale: "vi" | "en"): string | undefined =>
    textOf(spec.nodes.find((node) => node.key === key)?.exits?.[exit], locale)

/** The graph's own words of an outcome's title. */
const outcomeOf = (key: string): string | undefined => textOf(spec.outcomes?.find((outcome) => outcome.key === key)?.title, "vi")

/** The package view's own words of one output of a step. */
const packageWords = (key: string, output: string): string | undefined =>
    graphViewOfSpec(spec, { locale: "vi", withTrigger: true }).nodes.find((node) => node.id === key)?.outputs?.find((one) => one.id === output)?.label

const mapOf = (locale: "vi" | "en") => {
    const graph = dressedGraphOf(graphViewOfSpec(spec, { locale, withTrigger: true }), locale)
    return { graph, flow: framedFlowOf(stepsFlowOf(graph, locale), graph, locale) }
}

describe("the map of the sale graph", () => {
    const { graph, flow } = mapOf("vi")
    const words = mapWordsOf("vi")
    /** What the package view names the trigger card. */
    const triggerTitle = graph.nodes.find((node) => node.id === "trigger")?.title

    it("draws two dashed loop frames (talk and pay) that hold their bodies, with the graph's words and two ways out each", () => {
        const frames = flow.nodes.filter((node) => node.container !== undefined)
        expect(frames.map((node) => node.id).sort()).toEqual(["pay", "talk"])
        const talk = frames.find((node) => node.id === "talk")?.container
        const pay = frames.find((node) => node.id === "pay")?.container
        expect(talk?.childIds).toEqual(expect.arrayContaining(["opening", "hear", "consult"]))
        expect(pay?.childIds).toEqual(expect.arrayContaining(["await", "exact", "give-back"]))
        expect(talk?.childIds).not.toContain("create-order")
        expect(pay?.childIds).not.toContain("to-after-sale")
        expect(talk?.kind).toBe("loop")
        expect(pay?.kind).toBe("loop")
        expect(talk?.label).toBe(labelOf("talk", "vi"))
        expect(pay?.label).toBe(labelOf("pay", "vi"))
        expect(talk?.description).toBe(words.rounds(30))
        expect(pay?.description).toBe(words.rounds(6))
        expect(pay?.note).toBe(words.repeat)
        expect(talk?.exits?.map((exit) => exit.id)).toEqual(["until", "exhausted"])
        expect(pay?.exits).toEqual([
            { id: "until", label: exitOf("pay", "until", "vi") },
            { id: "exhausted", label: exitOf("pay", "exhausted", "vi") },
        ])
        // The ways out are the frame's own pills: no header chips.
        expect(talk?.chips).toBeUndefined()
        expect(pay?.chips).toBeUndefined()
    })

    it("keeps no edge from a loop to its first step, and leaves each frame's way out from its own exit", () => {
        expect(flow.edges.some((edge) => edge.source === "pay" && edge.target === "await")).toBe(false)
        for (const frame of ["talk", "pay"]) {
            const outOfFrame = flow.edges.filter((edge) => edge.source === frame)
            expect(outOfFrame.map((edge) => edge.sourcePort).sort()).toEqual(["exhausted", "until"])
            expect(outOfFrame.every((edge) => (edge.label ?? "") !== "")).toBe(true)
        }
        expect(flow.edges.find((edge) => edge.source === "pay" && edge.sourcePort === "until")?.target).toBe("to-after-sale")
        expect(flow.edges.find((edge) => edge.source === "pay" && edge.sourcePort === "exhausted")?.target).toBe("unpaid")
    })

    it("draws a wait as its own card with its label, events and time, one port per road, never the trigger card", () => {
        const waits = spec.nodes.filter((node) => node.step === "core.wait").map((node) => flow.nodes.find((card) => card.id === node.key))
        expect(waits.length).toBe(2)
        for (const card of waits) {
            expect(card?.kind).toBe("wait")
            expect(card?.label).not.toBe(triggerTitle)
            expect(card?.description ?? "").toContain(words.limit(1, "day"))
            expect((card?.outputs ?? []).length).toBeGreaterThan(0)
        }
        expect(flow.nodes.find((card) => card.id === "await")?.label).toBe(labelOf("await", "vi"))
        expect(flow.nodes.find((card) => card.id === "hear")?.label).toBe(labelOf("hear", "vi"))
        // The payment wait goes on three roads: the credit, the person's messages (grouped under one port) and the timeout.
        expect(flow.nodes.find((card) => card.id === "await")?.outputs?.map((port) => port.label)).toEqual([
            packageWords("await", "credit"),
            words.customerMessages,
            packageWords("await", "timeout"),
        ])
        const hear = flow.nodes.find((card) => card.id === "hear")
        expect(hear?.description).toContain(words.limit(1, "day"))
    })

    it("draws the timeout road as a dashed fallback road, and no placeholder", () => {
        const timeoutEdges = flow.edges.filter((edge) => edge.source === "await" && edge.isFallback === true)
        expect(timeoutEdges.length).toBe(1)
        expect(timeoutEdges[0]?.target).toBe("remind")
        expect(flow.edges.filter((edge) => edge.isFallback === true).length).toBe(1)
        expect(flow.edges.some((edge) => edge.isPlaceholder === true)).toBe(false)
    })
})

describe("the conditions, hand-backs and trigger of the sale map", () => {
    const { graph, flow } = mapOf("vi")
    const words = mapWordsOf("vi")
    const triggerTitle = graph.nodes.find((node) => node.id === "trigger")?.title
    const stepOf = (key: string) => spec.nodes.find((node) => node.key === key)

    it("draws every condition as a diamond with its own question and a yes and a no output, never the trigger card", () => {
        const conditions = spec.nodes.filter((node) => node.step === "core.when")
        expect(conditions.length).toBe(7)
        for (const step of conditions) {
            const card = flow.nodes.find((one) => one.id === step.key)
            expect(card?.kind).toBe("condition")
            expect(card?.shape).toBe("diamond")
            expect(card?.label).not.toBe(triggerTitle)
            expect(card?.label.endsWith("?")).toBe(true)
            expect((card?.outputs ?? []).map((port) => port.id)).toEqual(["yes", "no"])
            expect((card?.outputs ?? []).map((port) => port.label)).toEqual(["yes", "no"].map((id) => packageWords(card?.id ?? "", id)))
        }
        expect(flow.nodes.find((card) => card.id === "exact")?.label).toBe(labelOf("exact", "vi"))
        expect(flow.nodes.find((card) => card.id === "ready-said")?.label).toBe(labelOf("ready-said", "vi"))
        expect(flow.edges.find((edge) => edge.source === "ready-said" && edge.sourcePort === "yes")?.target).toBe("create-order")
        expect(flow.edges.find((edge) => edge.source === "ready-said" && edge.sourcePort === "no")?.target).toBe("cancel-said")
    })

    it("draws a hand-back as its own small card with the graph's label", () => {
        for (const key of ["give-back-talk", "give-back"]) {
            expect(stepOf(key)?.step).toBe("core.hand-back")
            expect(flow.nodes.find((card) => card.id === key)?.label).toBe(labelOf(key, "vi"))
        }
    })

    it("draws the trigger card once, for the graph's one trigger, and for no other step", () => {
        const cards = flow.nodes.filter((card) => card.label === triggerTitle)
        expect(spec.triggers?.length).toBe(1)
        expect(cards.map((card) => card.id)).toEqual(["trigger"])
        expect(graph.nodes.filter((node) => node.title === triggerTitle).length).toBe(1)
    })

    it("names every card in words (no raw key or expression), an end card by its outcome's title", () => {
        const keys = new Set(spec.nodes.map((node) => node.key))
        for (const card of flow.nodes) {
            expect(keys.has(card.label) && card.id === card.label).toBe(false)
            expect(card.label).not.toBe("")
        }
        expect(
            flow.nodes
                .filter((card) => card.kind === "end")
                .map((card) => card.label)
                .sort(),
        ).toEqual(["not-sale", "paid", "unpaid", "declined", "quiet"].map((key) => outcomeOf(key)).sort())
        for (const edge of flow.edges) expect(["yes", "no", "body", "exhausted", "timeout", "until"]).not.toContain(edge.label ?? "")
    })

    it("names the diamond and the frame in the legend, and nothing the map does not draw", () => {
        const legend = legendOf(stepsLegendOf("vi"), flow.nodes, "vi")
        expect(legend.find((item) => item.kind === "condition")?.shape).toBe("diamond")
        expect(legend.find((item) => item.kind === "loop")?.label).toBe(words.legendLoop)
        expect(legend.map((item) => item.kind)).toEqual(["event", "action", "condition", "wait", "loop"])
    })

    it("works in English", () => {
        const en = mapOf("en")
        const enWords = mapWordsOf("en")
        const pay = en.flow.nodes.find((card) => card.id === "pay")?.container
        expect(pay?.kind).toBe("loop")
        expect(pay?.label).toBe("Payment")
        expect(pay?.description).toBe(enWords.rounds(6))
        expect(pay?.exits?.map((exit) => exit.label)).toEqual(["Leaves when the order is paid", "6 rounds and still unpaid"])
        expect(en.flow.nodes.find((card) => card.id === "exact")?.label).toBe("Exact amount?")
        expect(en.flow.nodes.find((card) => card.id === "hear")?.description).toContain(enWords.limit(1, "day"))
        expect(legendOf(stepsLegendOf("en"), en.flow.nodes, "en").find((item) => item.kind === "loop")?.label).toBe("Loop")
    })
})
