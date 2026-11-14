import { coreNodeViews } from "./node-lists"
import { paramFieldsOf, type ParamField } from "./node-params"
import type { NodeLocale } from "./node-schema.types"
import {
    ENGINE_STEP,
    NODE_HEROICONS,
    STEP_CARD_ID,
    STOP_STEP_ID,
    TRIGGER_STEP,
    branchLabelOf,
    branchesOf,
    nodeSubtitleOf,
    nodeTitleOf,
    nodeUiOf,
    type NodeIcon,
    type NodeKind,
    type ViewNode,
} from "./node-ui"

/** One named output of a condition: the id a graph routes on and the words for it. */
export interface NodeOutputView {
    /** The branch id, the key of the node's `routes`. */
    readonly id: string
    /** The words for the branch in the language asked. */
    readonly label: string
}

/** A step as the editor and the graph draw it, in one language. */
export interface NodeCard {
    /** The node id (`payment.match-code`), `trigger` or `stop`. */
    readonly id: string
    /** What the step is to its owner. */
    readonly kind: NodeKind
    /** The icon name. */
    readonly icon: NodeIcon
    /** The Heroicons export the icon name stands for. */
    readonly heroicon: string
    /** The short Vietnamese or English name. */
    readonly title: string
    /** What the step does, in at most five words; never the title again. */
    readonly subtitle: string
    /** The named outputs of a step that branches (a condition, or a step whose output names its `branch`); empty for every other step. */
    readonly outputs: ReadonlyArray<NodeOutputView>
    /** The settings, with their form metadata and defaults. */
    readonly params: ReadonlyArray<ParamField>
}

const cardOf = (
    id: string,
    title: string,
    locale: NodeLocale,
    outputs: ReadonlyArray<string>,
    params: ReadonlyArray<ParamField>,
): NodeCard => {
    const ui = nodeUiOf(id)
    return {
        id,
        kind: ui.kind,
        icon: ui.icon,
        heroicon: NODE_HEROICONS[ui.icon],
        title,
        subtitle: nodeSubtitleOf(id, locale),
        outputs: outputs.map((branch): NodeOutputView => ({ id: branch, label: branchLabelOf(id, branch, locale) })),
        params,
    }
}

/** The card of a node, in one language. */
export const nodeCardOf = (
    node: ViewNode,
    locale: NodeLocale,
    values: Readonly<Record<string, unknown>> = {},
): NodeCard =>
    cardOf(node.id, nodeTitleOf(node, locale), locale, branchesOf(node), paramFieldsOf(node, locale, values))

/** The card of the pseudo step that stands for what wakes a graph. */
export const triggerCardOf = (locale: NodeLocale): NodeCard =>
    cardOf(TRIGGER_STEP, nodeTitleOf({ id: TRIGGER_STEP }, locale), locale, [], [])

/** The card of the built-in step that ends a run. */
export const stopCardOf = (locale: NodeLocale): NodeCard =>
    cardOf(STOP_STEP_ID, nodeTitleOf({ id: STOP_STEP_ID }, locale), locale, [], [])

/** The neutral card of a step this package does not know: a plain step, never the trigger's card. */
export const stepCardOf = (locale: NodeLocale): NodeCard => cardOf(STEP_CARD_ID, nodeTitleOf({ id: STEP_CARD_ID }, locale), locale, [], [])

/**
 * The named outputs of the engine's control steps: a condition's yes / no and an `until` loop's round and running out (its way out when
 * the condition holds is its `next`). A wait's outputs are its graph's own trigger keys and `timeout`, a hand-back has none.
 */
const ENGINE_OUTPUTS: Readonly<Record<string, ReadonlyArray<string>>> = {
    [ENGINE_STEP.when]: ["yes", "no"],
    [ENGINE_STEP.wait]: [],
    [ENGINE_STEP.until]: ["body", "exhausted"],
    [ENGINE_STEP.handBack]: [],
}

/** The cards of the engine's control steps (a condition, a wait, an `until` loop, a hand-back), by id, in one language. */
const engineCardsOf = (locale: NodeLocale): ReadonlyArray<[string, NodeCard]> =>
    Object.entries(ENGINE_OUTPUTS).map(([id, outputs]): [string, NodeCard] => [id, cardOf(id, nodeTitleOf({ id }, locale), locale, outputs, [])])

/**
 * The cards of every step of blocks-core (control and template nodes), of the engine's control steps, the trigger, the end and the neutral
 * step, by id, in one language.
 */
export const nodeCardsOf = (locale: NodeLocale): ReadonlyMap<string, NodeCard> =>
    new Map<string, NodeCard>([
        ...coreNodeViews.map((node): [string, NodeCard] => [node.id, nodeCardOf(node, locale)]),
        ...engineCardsOf(locale),
        [TRIGGER_STEP, triggerCardOf(locale)],
        [STOP_STEP_ID, stopCardOf(locale)],
        [STEP_CARD_ID, stepCardOf(locale)],
    ])
