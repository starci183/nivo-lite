import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
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
]

/** A JSON value with its object keys sorted, so two equal values always print the same text. */
const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical)
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

const rightKeys = (spec: GraphSpec | null): ReadonlyArray<string> =>
    (spec?.grant.rights ?? []).flatMap((right) => right.fields.map((field) => `${right.kind}:${right.access}.${field}`))

const gained = (before: ReadonlyArray<string>, after: ReadonlyArray<string>): ReadonlyArray<string> =>
    [...new Set(after)].filter((item) => !before.includes(item)).sort((left, right) => left.localeCompare(right))

/** What the grant of `after` holds that `before` does not, and the other way round. */
const grantDiff = (before: GraphSpec | null, after: GraphSpec): GrantDiff => {
    const tools = before?.grant.tools ?? []
    const effects = before?.grant.effects ?? []
    return {
        rightsAdded: gained(rightKeys(before), rightKeys(after)),
        rightsRemoved: gained(rightKeys(after), rightKeys(before)),
        toolsAdded: gained(tools, after.grant.tools),
        toolsRemoved: gained(after.grant.tools, tools),
        effectsAdded: gained(effects, after.grant.effects),
        effectsRemoved: gained(after.grant.effects, effects),
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
    }
}

/** How many steps differ between two graphs. */
export const changedStepCount = (before: GraphSpec | null, after: GraphSpec): number =>
    workflowDiffOf(before, after).steps.length
