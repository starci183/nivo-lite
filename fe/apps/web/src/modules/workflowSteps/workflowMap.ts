import type { FlowGraphEdge, FlowGraphLegendItem, FlowGraphNode, FlowGraphPort } from "@starci/grammar/common"
import type { GraphEdgeView, GraphNodeView, GraphView } from "@/modules/plugin-registry"
import { mapWordsOf, type MapWords } from "./workflowMap.words"

/*
 * What the map adds to the package view of a template graph (`graphViewOfSpec` + `stepsFlowOf`). The package gives every control step its own
 * card with the graph's real words (a condition's question, a wait's, a loop's and a hand-back's label, a loop's two ways out, an outcome's
 * title) and a loop its body (`node.loop`). The map only draws what the package's flat card map cannot: a condition as a diamond with its yes
 * and no ports, a wait with one port per road (the events that lead to the same step share it) and its time, a loop as a dashed frame
 * with its ways out on the frame's edge, a timeout road dashed, a legend that names the diamond and the frame.
 */

/** The step ids of the control steps the map draws itself (the adapter of the back end writes them). */
const IF_STEP = "core.when"
const WAIT_STEP = "core.wait"
const UNTIL_STEP = "core.until"

/** The step id of the trigger card the package view adds first. */
const TRIGGER_STEP = "trigger"

/** The route of a loop to the first step of its body, and the route taken when its rounds ran out. */
const BODY_ROUTE = "body"
const EXHAUSTED_ROUTE = "exhausted"

/** The id of the way out of a loop when its condition holds (its edge is the loop's `next`: it names no route). */
const UNTIL_EXIT = "until"

/** The route of a wait whose time ran out. */
const TIMEOUT_ROUTE = "timeout"

/** The verbs of a customer's message: the port of a wait groups them under one word when there are many. */
const MESSAGE_VERB = /\.message\.received$/

/** The most event names a wait's line or port spells out. */
const NAMES_MAX = 2

type StepEdge = GraphEdgeView

/** The nodes and edges of a card map. */
interface MapFlow {
    readonly nodes: ReadonlyArray<FlowGraphNode>
    readonly edges: ReadonlyArray<FlowGraphEdge>
}

/** A written value as a record, or null when it is not one. */
const recordOf = (value: unknown): Readonly<Record<string, unknown>> | null =>
    typeof value === "object" && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null

/** One thing a wait listens for: the key its route is named by and its verb. */
interface WaitOn {
    readonly key: string
    readonly verb: string
}

/** What a wait listens for, from its params. */
const waitOnsOf = (node: GraphNodeView): ReadonlyArray<WaitOn> => {
    const written = node.params?.on
    return (Array.isArray(written) ? written : []).flatMap((one: unknown): ReadonlyArray<WaitOn> => {
        const record = recordOf(one)
        return record !== null && typeof record.key === "string" && typeof record.verb === "string"
            ? [{ key: record.key, verb: record.verb }]
            : []
    })
}

/** The words of how long a wait waits at most, or an empty text when the params name no time. */
const limitOf = (value: unknown, words: MapWords): string => {
    const record = recordOf(value)
    if (record === null) return ""
    const units = ["minute", "hour", "day"] as const
    for (const unit of units) {
        const amount = record[`${unit}s`]
        if (typeof amount === "number") return words.limit(amount, unit)
    }
    return ""
}

/** The distinct words of a list, in order. */
const distinct = (list: ReadonlyArray<string>): ReadonlyArray<string> => [...new Set(list)]

/** A list of names as one line or port label: the first few, then "+N". */
const shortList = (names: ReadonlyArray<string>): string =>
    names.length <= NAMES_MAX ? names.join(", ") : `${names.slice(0, NAMES_MAX).join(", ")} +${names.length - NAMES_MAX}`

/**
 * The words of one road of a wait: the package view's own (its output's label), else the owner's words of the verb the road listens for;
 * the road's key when neither knows it.
 */
const routeWordsOf = (route: string, wait: GraphNodeView, words: MapWords): string => {
    const own = wait.outputs?.find((output) => output.id === route)?.label
    if (own !== undefined && own !== route) return own
    const verb = waitOnsOf(wait).find((one) => one.key === route)?.verb
    return (verb === undefined ? undefined : words.verbs[verb]) ?? route
}

/** The port words of the routes of a wait that lead to the same step: the events' names, or "timed out". */
const waitPortWords = (routes: ReadonlyArray<string>, wait: GraphNodeView, words: MapWords): string => {
    const ons = waitOnsOf(wait)
    const events = routes.flatMap((route): ReadonlyArray<WaitOn> => ons.filter((one) => one.key === route))
    const hasTimeout = routes.includes(TIMEOUT_ROUTE)
    const isMessages = events.length > NAMES_MAX && !hasTimeout && events.every((one) => MESSAGE_VERB.test(one.verb))
    return isMessages ? words.customerMessages : shortList(distinct(routes.map((route) => routeWordsOf(route, wait, words))))
}

/** The max rounds of a loop step, or null when the params name none. */
const maxOf = (node: GraphNodeView): number | null => {
    const max = node.params?.max
    return typeof max === "number" ? max : null
}

/** The port an edge leaves from: the first route it carries. */
const portIdOf = (edge: StepEdge): string => edge.fromOutput ?? edge.fromOutputs?.[0] ?? ""

/** The way out an edge of a loop leaves by: the exhausted route, or the loop's own `next` (its condition held). */
const exitIdOf = (edge: StepEdge): string => (edge.fromOutput === EXHAUSTED_ROUTE ? EXHAUSTED_ROUTE : UNTIL_EXIT)

/** The wait as the map draws it: the package's card with its events and time as the line, and one port per road. */
const dressedWaitOf = (node: GraphNodeView, edges: ReadonlyArray<StepEdge>, words: MapWords): GraphNodeView => {
    const out = edges.filter((edge) => edge.from === node.id && edge.back !== true)
    const events = distinct(waitOnsOf(node).map((one) => routeWordsOf(one.key, node, words)))
    const limit = limitOf(node.params?.timeout, words)
    const line = limit === "" ? shortList(events) : words.waitLine(shortList(events), limit)
    return {
        ...node,
        description: line,
        subtitle: line,
        outputs: out.map((edge) => ({ id: portIdOf(edge), label: waitPortWords(edge.fromOutputs ?? [portIdOf(edge)], node, words) })),
    }
}

/**
 * The graph view of a template graph with its waits dressed (their events and time, a port per road) and its edges worded; the trigger card
 * names the graph's real triggers. Every other step is as the package view gave it, with the graph's own words.
 */
export const dressedGraphOf = (graph: GraphView, locale: "vi" | "en"): GraphView => {
    const words = mapWordsOf(locale)
    const nodes = graph.nodes.map((node) => {
        if (node.step === WAIT_STEP) return dressedWaitOf(node, graph.edges, words)
        if (node.id !== TRIGGER_STEP || node.step !== TRIGGER_STEP) return node
        const sources = distinct((graph.triggers ?? []).map((trigger) => trigger.sourceLabel))
        return sources.length === 0 ? node : { ...node, description: sources.join(" · "), subtitle: sources.join(" · ") }
    })
    const byId = new Map(graph.nodes.map((node): [string, GraphNodeView] => [node.id, node]))
    return {
        ...graph,
        nodes,
        edges: graph.edges.map((edge): StepEdge => {
            const from = byId.get(edge.from)
            if (from?.step !== WAIT_STEP) return edge
            const label = waitPortWords(edge.fromOutputs ?? [], from, words)
            return label === "" ? edge : { ...edge, label, condition: label }
        }),
    }
}

/**
 * The loop frame of a loop step, from the package view's own loop (`node.loop`: its body and the graph's words for its two ways out): its
 * name, the round limit after it, the line about going round, and the ways out as pills on the frame's edge.
 */
const frameOf = (loop: GraphNodeView, graph: GraphView, words: MapWords): NonNullable<FlowGraphNode["container"]> => {
    const max = maxOf(loop)
    const outs = graph.edges.filter((edge) => edge.from === loop.id && edge.fromOutput !== BODY_ROUTE)
    return {
        kind: "loop",
        label: loop.title ?? loop.label,
        ...(max === null ? {} : { description: words.rounds(max) }),
        note: words.repeat,
        exits: outs.map((edge) => ({ id: exitIdOf(edge), label: edge.label ?? "" })),
        childIds: loop.loop?.bodyKeys ?? [],
    }
}

/** The ports of a card map node: the outputs of a condition or wait, as the card draws them. */
const portsOf = (node: GraphNodeView): ReadonlyArray<FlowGraphPort> | undefined =>
    node.step === IF_STEP || node.step === WAIT_STEP
        ? (node.outputs ?? []).map((output): FlowGraphPort => ({ id: output.id, label: output.label }))
        : undefined

/**
 * The map's nodes and edges after the package's step cards: a condition is drawn as a diamond with its yes and no ports, a wait as a wait
 * card with a port per way it goes on, a loop as a dashed frame holding its body with its ways out on the frame's edge (an edge out of the
 * frame leaves from its exit); the edge from a loop to its first step is dropped (the frame holds it); a wait's timeout road is dashed.
 */
export const framedFlowOf = (flow: MapFlow, graph: GraphView, locale: "vi" | "en"): MapFlow => {
    const words = mapWordsOf(locale)
    const byId = new Map(graph.nodes.map((node): [string, GraphNodeView] => [node.id, node]))
    const bodyEdges = new Set(graph.edges.filter((edge) => byId.get(edge.from)?.step === UNTIL_STEP && edge.fromOutput === BODY_ROUTE).map((edge) => edge.id))
    const edgeById = new Map(graph.edges.map((edge): [string, StepEdge] => [edge.id, edge]))
    return {
        nodes: flow.nodes.map((node) => {
            const source = byId.get(node.id)
            if (source === undefined) return node
            const ports = portsOf(source)
            if (source.step === UNTIL_STEP) return { ...node, container: frameOf(source, graph, words) }
            if (ports === undefined) return node
            return { ...node, outputs: ports, ...(source.step === IF_STEP ? { shape: "diamond" as const } : {}) }
        }),
        edges: flow.edges
            .filter((edge) => !bodyEdges.has(edge.id))
            .map((edge) => {
                const source = byId.get(edge.source)
                const written = edgeById.get(edge.id)
                if (source === undefined || written === undefined) return edge
                const isPorted = source.step === IF_STEP || source.step === WAIT_STEP
                const port = portIdOf(written)
                const isTimeout = source.step === WAIT_STEP && (written.fromOutputs ?? []).includes(TIMEOUT_ROUTE)
                return {
                    ...edge,
                    ...(isPorted && port !== "" ? { sourcePort: port } : {}),
                    ...(isTimeout ? { isFallback: true } : {}),
                    ...(source.step === UNTIL_STEP
                        ? { sourcePort: exitIdOf(written), ...(written.label === undefined ? {} : { label: written.label }) }
                        : {}),
                }
            }),
    }
}

/**
 * The legend under a map: the kinds the map really uses, in the package's order and words, the condition's swatch a diamond when the map
 * draws its conditions so, and the loop frame when the map holds one.
 */
export const legendOf = (
    legend: ReadonlyArray<FlowGraphLegendItem>,
    nodes: ReadonlyArray<FlowGraphNode>,
    locale: "vi" | "en",
): ReadonlyArray<FlowGraphLegendItem> => {
    const used = new Set<string>(nodes.map((node) => node.kind ?? "action"))
    const isDiamond = nodes.some((node) => node.shape === "diamond")
    const kinds = legend
        .filter((item) => used.has(item.kind))
        .map((item): FlowGraphLegendItem => (item.kind === "condition" && isDiamond ? { ...item, shape: "diamond" } : item))
    const hasFrame = nodes.some((node) => node.container?.kind === "loop")
    return hasFrame ? [...kinds, { kind: "loop", label: mapWordsOf(locale).legendLoop }] : kinds
}
