import { nodeAccountRequestsOf, type GraphSpec, type GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { NodeRightAsk, NodeRightsDiff } from "../agent-workflow-rights.contracts"
import type { GrantDiff, ParamChange, StepDiff, StepPart, WorkflowDiff } from "../agent-workflows.contracts"

/** The parts of a node compared, in the order a diff lists them. */
const PARTS: ReadonlyArray<StepPart> = [
    "kind",
    "step",
    "params",
    "input",
    "next",
    "routes",
    "blocking",
    "group",
    "wait",
    "accounts",
]

/** A JSON value with its object keys sorted, so two equal values always print the same text. */
const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map((item) => canonical(item))
    if (value !== null && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value)
                .filter(([, entry]) => entry !== undefined)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, entry]) => [key, canonical(entry)]),
        )
    }
    return value
}

/** The canonical text of a value: equal values give equal texts whatever the order of their keys. */
export const canonicalText = (value: unknown): string => JSON.stringify(canonical(value)) ?? "null"

/** Whether two values are the same JSON. */
export const sameJson = (left: unknown, right: unknown): boolean => canonicalText(left) === canonicalText(right)

const valueOrNull = (value: JsonValue | undefined): JsonValue | null => value ?? null

/** The settings of a step that differ, by name, in name order. */
const paramChanges = (before: GraphSpecNode, after: GraphSpecNode): ReadonlyArray<ParamChange> => {
    const was = before.params ?? {}
    const is = after.params ?? {}
    return [...new Set([...Object.keys(was), ...Object.keys(is)])]
        .sort((left, right) => left.localeCompare(right))
        .filter((name) => !sameJson(was[name], is[name]))
        .map((name) => ({ name, before: valueOrNull(was[name]), after: valueOrNull(is[name]) }))
}

/** The parts of a node that differ between two of its versions. */
const partsChanged = (before: GraphSpecNode, after: GraphSpecNode): ReadonlyArray<StepPart> =>
    PARTS.filter((part) => !sameJson(before[part], after[part]))

/** Whether a node is the same in two graphs. */
export const sameStep = (before: GraphSpecNode | undefined, after: GraphSpecNode | undefined): boolean =>
    sameJson(before, after)

const gained = (before: ReadonlyArray<string>, after: ReadonlyArray<string>): ReadonlyArray<string> =>
    [...new Set(after)].filter((item) => !before.includes(item)).sort((left, right) => left.localeCompare(right))

/** What the grant of `after` holds that `before` does not, and the other way round. */
const grantDiff = (before: GraphSpec | null, after: GraphSpec): GrantDiff => {
    const tools = before?.grant.tools ?? []
    const effects = before?.grant.effects ?? []
    return {
        toolsAdded: gained(tools, after.grant.tools),
        toolsRemoved: gained(after.grant.tools, tools),
        effectsAdded: gained(effects, after.grant.effects),
        effectsRemoved: gained(after.grant.effects, effects),
    }
}

const askKeyOf = (ask: NodeRightAsk): string =>
    JSON.stringify([ask.nodeKey, ask.kind, ask.provider, ask.connectionId, ask.operation])

/**
 * How what the nodes ask for on accounts differs between two graphs. A node that states its accounts in both is compared entry by
 * entry; a node only one graph holds gives all its entries as added or removed. A node that stated none before (a node from before
 * node rights asked for exactly what its workflow had granted it, which a graph does not say) is not compared: stating them is no
 * change of what it asks.
 */
export const nodeRightsDiffOf = (before: GraphSpec | null, after: GraphSpec): NodeRightsDiff => {
    const was = new Map((before?.nodes ?? []).map((node) => [node.key, node]))
    const is = new Map(after.nodes.map((node) => [node.key, node]))
    const compared = (node: GraphSpecNode, other: GraphSpecNode | undefined): boolean =>
        node.accounts !== undefined && (other === undefined || other.accounts !== undefined)
    const asked = nodeAccountRequestsOf(after.nodes.filter((node) => compared(node, was.get(node.key))))
    const held = nodeAccountRequestsOf((before?.nodes ?? []).filter((node) => compared(node, is.get(node.key))))
    const heldByKey = new Map(held.map((ask) => [askKeyOf(ask), ask]))
    const askedKeys = new Set(asked.map((ask) => askKeyOf(ask)))
    return {
        added: asked.filter((ask) => !heldByKey.has(askKeyOf(ask))),
        removed: held.filter((ask) => !askedKeys.has(askKeyOf(ask))),
        loosened: asked.filter((ask) => ask.mode === "auto" && heldByKey.get(askKeyOf(ask))?.mode === "ask"),
    }
}

/**
 * How graph `after` differs from graph `before`, step by step: a node is the same step in both when it has the same key. A step only
 * `after` holds is added, one only `before` holds is removed, and one whose kind, SDK step, settings, inputs, edges, side-step flag,
 * group or wait differ is changed, with the settings that moved. `before` null (a first version) makes every step added. Steps come
 * in the order of `after`, the removed ones last in the order of `before`.
 */
export const workflowDiffOf = (before: GraphSpec | null, after: GraphSpec): WorkflowDiff => {
    const was = new Map((before?.nodes ?? []).map((node) => [node.key, node]))
    const is = new Set(after.nodes.map((node) => node.key))
    const present = after.nodes.flatMap((node): ReadonlyArray<StepDiff> => {
        const old = was.get(node.key)
        if (old === undefined) return [{ key: node.key, change: "added", step: node.step, parts: [], params: [] }]
        if (sameStep(old, node)) return []
        return [
            {
                key: node.key,
                change: "changed",
                step: node.step,
                parts: partsChanged(old, node),
                params: paramChanges(old, node),
            },
        ]
    })
    const removed = (before?.nodes ?? [])
        .filter((node) => !is.has(node.key))
        .map((node): StepDiff => ({ key: node.key, change: "removed", step: node.step, parts: [], params: [] }))
    return {
        steps: [...present, ...removed],
        triggerChanged: before !== null && !sameJson(before.trigger, after.trigger),
        grant: grantDiff(before, after),
        nodeRights: nodeRightsDiffOf(before, after),
    }
}

/** How many steps differ between two graphs. */
export const changedStepCount = (before: GraphSpec | null, after: GraphSpec): number =>
    workflowDiffOf(before, after).steps.length
