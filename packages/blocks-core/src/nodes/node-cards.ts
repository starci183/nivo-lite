import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { coreNodes } from "./core-nodes"
import { paramFieldsOf } from "./node-params"
import type { ParamField } from "./node-params"
import type { NodeLocale } from "./node-schema.types"
import {
    NODE_HEROICONS,
    STOP_STEP_ID,
    TRIGGER_STEP,
    branchLabelOf,
    branchesOf,
    nodeSubtitleOf,
    nodeTitleOf,
    nodeUiOf,
} from "./node-ui"
import type { NodeIcon, NodeKind } from "./node-ui"

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
    node: NodeDefinition,
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

/** The cards of every core node, the trigger and the end, by id, in one language. */
export const nodeCardsOf = (locale: NodeLocale): ReadonlyMap<string, NodeCard> =>
    new Map<string, NodeCard>([
        ...coreNodes.map((node): [string, NodeCard] => [node.id, nodeCardOf(node, locale)]),
        [TRIGGER_STEP, triggerCardOf(locale)],
        [STOP_STEP_ID, stopCardOf(locale)],
    ])
