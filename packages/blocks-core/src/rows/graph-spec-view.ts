import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { LOOP_BODY_ROUTE, LOOP_ITEMS_PARAM, LOOP_STEP } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { FOR_EACH_MAX } from "../nodes/core/for-each.node"
import { messageNamed } from "../messages/catalog"
import { coreNodes } from "../nodes/core-nodes"
import { nodeCardsOf, stopCardOf, triggerCardOf } from "../nodes/node-cards"
import type { NodeCard } from "../nodes/node-cards"
import { paramFieldsOf } from "../nodes/node-params"
import type { NodeLocale } from "../nodes/node-schema.types"
import { STOP_STEP_ID, TRIGGER_STEP } from "../nodes/node-ui"
import type { GraphEdgeView, GraphNodeState, GraphNodeView, GraphView } from "./graph-view"
import {
    bindingViewOf,
    bindingViewsOf,
    callViewOf,
    entryViewOf,
    outcomeEndViewOf,
    outcomeViewsOf,
    triggerViewsOf,
} from "./workflow-contract-view"

/** The catalog key of the words on a back edge a spec writes out of a wait: the work comes back after a timer. */
const TIMEOUT = "graphBackTimeout"

/** The most output labels an edge shows; more outputs to the same step read as "others" and keep the list in `fromOutputs`. */
const LABELS_MAX = 3

/** What `graphViewOfSpec` is told besides the spec. */
export interface GraphSpecViewOptions {
    /** The language of every title, subtitle and label. */
    readonly locale: NodeLocale
    /** The state each node reached in the last run, by node key. */
    readonly states?: Readonly<Record<string, GraphNodeState>> | undefined
    /** True to draw the trigger as the first node, joined to the first step; false (the default) leaves it out. */
    readonly withTrigger?: boolean | undefined
}

/** The card of a step: its own, or the stop/trigger pseudo steps. */
const cardFor = (step: string, cards: ReadonlyMap<string, NodeCard>, locale: NodeLocale): NodeCard =>
    cards.get(step) ?? (step === STOP_STEP_ID ? stopCardOf(locale) : triggerCardOf(locale))

/** The `from->to` pairs of a depth-first walk from the first node that lead back onto the walk's own stack: the ways back. */
const backPairs = (spec: GraphSpec): ReadonlySet<string> => {
    const byKey = new Map(spec.nodes.map((node): [string, GraphSpecNode] => [node.key, node]))
    const found = new Set<string>()
    const onStack = new Set<string>()
    const done = new Set<string>()
    const walk = (key: string): void => {
        const node = byKey.get(key)
        if (node === undefined || done.has(key)) return
        onStack.add(key)
        for (const target of [...(node.next === undefined ? [] : [node.next]), ...Object.values(node.routes ?? {})]) {
            if (onStack.has(target)) found.add(`${key}->${target}`)
            else walk(target)
        }
        onStack.delete(key)
        done.add(key)
    }
    const first = spec.nodes[0]
    if (first !== undefined) walk(first.key)
    return found
}

/** The words on a back edge by the kind of the step it leaves: a timer after a wait; none for the rest. */
const backWordsOf = (card: NodeCard, locale: NodeLocale): string | undefined => {
    if (card.kind === "wait") return messageNamed(locale, TIMEOUT) ?? undefined
    return undefined
}

/** The edges that leave one node, one per target (the outputs that lead to the same target share an edge). */
const edgesOfNode = (
    node: GraphSpecNode,
    card: NodeCard,
    backs: ReadonlySet<string>,
    locale: NodeLocale,
): ReadonlyArray<GraphEdgeView> => {
    const labelOf = (branch: string): string =>
        card.outputs.find((output) => output.id === branch)?.label ?? branch
    const outputWords = (outputs: ReadonlyArray<string>): string | undefined => {
        if (outputs.length === 0) return undefined
        if (outputs.length > LABELS_MAX) return messageNamed(locale, "graphEdgeOthers") ?? undefined
        return outputs.map(labelOf).join(", ")
    }
    const edge = (to: string, outputs: ReadonlyArray<string>): GraphEdgeView => {
        const back = backs.has(`${node.key}->${to}`)
        const words = outputWords(outputs)
        const label = back ? (backWordsOf(card, locale) ?? words) : words
        return {
            id: outputs.length === 0 ? `${node.key}->${to}` : `${node.key}:${outputs.join("+")}->${to}`,
            from: node.key,
            to,
            ...(label === undefined ? {} : { label, condition: label }),
            ...(outputs[0] === undefined ? {} : { fromOutput: outputs[0], fromOutputs: outputs }),
            ...(back ? { back: true } : {}),
        }
    }
    const targets = new Map<string, Array<string>>()
    for (const [branch, to] of Object.entries(node.routes ?? {})) targets.set(to, [...(targets.get(to) ?? []), branch])
    return [
        ...(node.next === undefined ? [] : [edge(node.next, [])]),
        ...[...targets].map(([to, outputs]) => edge(to, outputs)),
    ]
}

/** The values a node's settings hold in a graph: the parsed ones (defaults filled in), else what the spec wrote. */
/** The body keys of every for-each step, by the loop's key: its `body` route and every node that follows it inside the body. */
const loopBodiesOf = (spec: GraphSpec): ReadonlyMap<string, ReadonlyArray<string>> => {
    const byKey = new Map(spec.nodes.map((node) => [node.key, node]))
    const bodies = new Map<string, ReadonlyArray<string>>()
    for (const loop of spec.nodes.filter((node) => node.step === LOOP_STEP)) {
        const seen = new Set<string>()
        const pending = [loop.routes?.[LOOP_BODY_ROUTE]].filter((key): key is string => key !== undefined)
        for (let key = pending.pop(); key !== undefined; key = pending.pop()) {
            const node = byKey.get(key)
            if (node === undefined || seen.has(key) || key === loop.key) continue
            seen.add(key)
            pending.push(...[node.next, ...Object.values(node.routes ?? {})].filter((next): next is string => next !== undefined))
        }
        bodies.set(loop.key, [...seen])
    }
    return bodies
}

/** The contract parts of one node: its bindings, its hand-off or outcome, its "Lỗi" route, its loop and the loop that holds it. */
const contractPartsOf = (
    spec: GraphSpec,
    node: GraphSpecNode,
    locale: NodeLocale,
    loops: ReadonlyMap<string, ReadonlyArray<string>>,
): Partial<GraphNodeView> => {
    const call = callViewOf(node, locale)
    const outcome = outcomeEndViewOf(node, spec, locale)
    const body = loops.get(node.key)
    const parent = [...loops.entries()].find(([, keys]) => keys.includes(node.key))?.[0]
    const params: Readonly<Record<string, unknown>> = node.params ?? {}
    const max = params.max
    return {
        bindings: bindingViewsOf(params, locale),
        ...(call === null ? {} : { call }),
        ...(outcome === null ? {} : { outcome }),
        ...(body === undefined
            ? {}
            : {
                  loop: {
                      items: params[LOOP_ITEMS_PARAM] === undefined ? null : bindingViewOf(LOOP_ITEMS_PARAM, params[LOOP_ITEMS_PARAM], locale),
                      max: typeof max === "number" ? max : FOR_EACH_MAX,
                      bodyKeys: body,
                  },
              }),
        ...(parent === undefined ? {} : { parent }),
    }
}

const valuesOf = (
    params: GraphSpecNode["params"],
    parse: ((input: unknown) => { readonly success: boolean; readonly data?: unknown }) | undefined,
): Readonly<Record<string, unknown>> => {
    const written: Readonly<Record<string, unknown>> = params ?? {}
    const parsed = parse?.(written)
    return parsed?.success === true && typeof parsed.data === "object" && parsed.data !== null
        ? { ...parsed.data }
        : { ...written }
}

/**
 * The graph view of a graph spec, in one language: every node with its card (kind, icon, title, subtitle, named outputs), its settings
 * with their form metadata and the values this graph gives them; every edge with the output it leaves from, and `back` plus a short
 * reason for one that returns after an owner decision or a timeout. Existing fields stay: `label` is the title, `description` the
 * subtitle, an edge's `condition` its words.
 */
export const graphViewOfSpec = (spec: GraphSpec, options: GraphSpecViewOptions): GraphView => {
    const { locale } = options
    const cards = nodeCardsOf(locale)
    const definitions = new Map<string, NodeDefinition>(coreNodes.map((node) => [node.id, node]))
    const backs = backPairs(spec)
    const loops = loopBodiesOf(spec)
    const nodes = spec.nodes.map((node): GraphNodeView => {
        const card = cardFor(node.step, cards, locale)
        const definition = definitions.get(node.step)
        const values = valuesOf(node.params, definition === undefined ? undefined : (input) => definition.params.safeParse(input))
        const state = options.states?.[node.key]
        return {
            id: node.key,
            label: card.title,
            kind: card.kind,
            description: card.subtitle,
            ...(state === undefined ? {} : { state }),
            step: node.step,
            title: card.title,
            subtitle: card.subtitle,
            icon: card.icon,
            heroicon: card.heroicon,
            ...(node.group === undefined ? {} : { group: node.group }),
            outputs: card.outputs,
            params: values,
            paramFields: definition === undefined ? [] : paramFieldsOf(definition, locale, values),
            ...contractPartsOf(spec, node, locale, loops),
        }
    })
    const spoken = spec.nodes.flatMap((node) => edgesOfNode(node, cardFor(node.step, cards, locale), backs, locale))
    const first = spec.nodes[0]
    const trigger = options.withTrigger === true && first !== undefined
    const triggerCard = triggerCardOf(locale)
    const triggerNode: GraphNodeView = {
        id: TRIGGER_STEP,
        label: triggerCard.title,
        kind: triggerCard.kind,
        description: triggerCard.subtitle,
        step: TRIGGER_STEP,
        title: triggerCard.title,
        subtitle: triggerCard.subtitle,
        icon: triggerCard.icon,
        heroicon: triggerCard.heroicon,
        outputs: [],
        params: {},
        paramFields: [],
    }
    return {
        ...(spec.triggers === undefined ? {} : { triggers: triggerViewsOf(spec, locale) }),
        ...(spec.outcomes === undefined ? {} : { outcomes: outcomeViewsOf(spec, locale) }),
        entry: entryViewOf(spec, locale),
        nodes: trigger ? [triggerNode, ...nodes] : nodes,
        edges: [
            ...(trigger ? [{ id: `${TRIGGER_STEP}->${first.key}`, from: TRIGGER_STEP, to: first.key }] : []),
            ...spoken,
        ],
    }
}
