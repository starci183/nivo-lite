import type { GraphSpec, GraphSpecGrant, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import type { NodeIndex } from "@nivo-lite/agent-sdk/node"
import type { DataRight } from "@nivo-lite/agent-sdk/rights"
import type { MergeConflict, TemplateMerge } from "../agent-workflows.contracts"
import { sameJson, sameStep } from "./workflow-diff.policy"

/** What the merge of one step keeps: a node, or nothing (removed), and whether both sides had changed it. */
interface StepMerge {
    readonly node: GraphSpecNode | undefined
    readonly conflict: boolean
}

const take = (node: GraphSpecNode | undefined, conflict = false): StepMerge => ({ node, conflict })

/**
 * The three-way merge of one step: `base` is the step in the template version the workflow came from, `ours` in the workflow, `theirs`
 * in the newer template version. A side that left the step as it was takes the other side's change (an edit, an addition or a
 * removal); when both changed it differently, the owner's side is kept and the step is a conflict. The owner's work is never lost.
 */
const mergeStep = (
    base: GraphSpecNode | undefined,
    ours: GraphSpecNode | undefined,
    theirs: GraphSpecNode | undefined,
): StepMerge => {
    if (sameStep(ours, theirs)) return take(ours)
    if (sameStep(ours, base)) return take(theirs)
    if (sameStep(theirs, base)) return take(ours)
    return take(ours, true)
}

const byKey = (spec: GraphSpec): ReadonlyMap<string, GraphSpecNode> =>
    new Map(spec.nodes.map((node) => [node.key, node]))

/**
 * Merges a newer template version into a workflow: each step as `mergeStep` says, in the workflow's order with the steps only the
 * template added appended in the template's order (so the step that starts the run stays the owner's). The trigger merges the same
 * way. The grant is the union of both sides, for `minimumGrantOf` to trim to what the merged steps need. Pure: it reads three
 * snapshots and writes none.
 */
export const mergeTemplate = (base: GraphSpec, ours: GraphSpec, theirs: GraphSpec): TemplateMerge => {
    const was = byKey(base)
    const mine = byKey(ours)
    const next = byKey(theirs)
    const order = [
        ...ours.nodes.map((node) => node.key),
        ...theirs.nodes.map((node) => node.key).filter((key) => !mine.has(key) && !was.has(key)),
    ]
    const merged = order.map((key) => ({ key, ...mergeStep(was.get(key), mine.get(key), next.get(key)) }))
    const triggerTakesTheirs = sameJson(ours.trigger, base.trigger)
    const triggerConflict =
        !triggerTakesTheirs && !sameJson(theirs.trigger, base.trigger) && !sameJson(ours.trigger, theirs.trigger)
    const conflicts: ReadonlyArray<MergeConflict> = [
        ...(triggerConflict ? [{ key: "trigger", kept: "ours" as const }] : []),
        ...merged.filter((step) => step.conflict).map((step) => ({ key: step.key, kept: "ours" as const })),
    ]
    return {
        graph: {
            ...ours,
            trigger: triggerTakesTheirs ? theirs.trigger : ours.trigger,
            grant: grantUnion(ours.grant, theirs.grant),
            nodes: merged.flatMap((step) => (step.node === undefined ? [] : [step.node])),
        },
        conflicts,
    }
}

const union = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): ReadonlyArray<string> => [
    ...new Set([...left, ...right]),
]

/** The fields of a right, or null when none is left: a right always covers at least one field. */
const fieldsOrNull = (fields: ReadonlyArray<string>): DataRight["fields"] | null => {
    const [first, ...rest] = fields
    return first === undefined ? null : [first, ...rest]
}

/** The rights of two grants together: one entry per kind and access, with the fields of both. */
const rightsUnion = (left: ReadonlyArray<DataRight>, right: ReadonlyArray<DataRight>): ReadonlyArray<DataRight> => {
    const found = new Map<string, DataRight>()
    ;[...left, ...right].forEach((entry) => {
        const at = `${entry.kind}:${entry.access}:${entry.scope}`
        const held = found.get(at)
        const fields = held === undefined ? null : fieldsOrNull(union(held.fields, entry.fields))
        found.set(at, held === undefined || fields === null ? entry : { ...held, fields })
    })
    return [...found.values()]
}

const grantUnion = (left: GraphSpecGrant, right: GraphSpecGrant): GraphSpecGrant => ({
    rights: [...rightsUnion(left.rights, right.rights)],
    tools: [...union(left.tools, right.tools)],
    effects: [...union(left.effects, right.effects)],
})

/**
 * The grant of a graph cut to what its installed steps need: the rights of each step and of every effect and tool it uses, the effects
 * and the tools it uses. A right, tool or effect the grant does not hold is never added, so the cut never widens the agent.
 */
export const minimumGrantOf = (spec: GraphSpec, index: NodeIndex): GraphSpecGrant => {
    const nodes = spec.nodes.flatMap((node) => {
        const definition = index.nodes.get(node.step)
        return definition === undefined ? [] : [definition]
    })
    const needed = nodes.flatMap((node) => [
        ...node.rights,
        ...node.effects.flatMap((effect) => index.effects.get(effect)?.rights ?? []),
        ...(node.tools ?? []).flatMap((tool) => index.tools.get(tool)?.rights ?? []),
    ])
    const fieldsOf = (kind: string, access: string): ReadonlySet<string> =>
        new Set(
            needed.filter((right) => right.kind === kind && right.access === access).flatMap((right) => right.fields),
        )
    const effects = new Set<string>(nodes.flatMap((node) => node.effects))
    const tools = new Set<string>(nodes.flatMap((node) => node.tools ?? []))
    return {
        rights: spec.grant.rights.flatMap((right): ReadonlyArray<DataRight> => {
            const fields = fieldsOrNull(right.fields.filter((field) => fieldsOf(right.kind, right.access).has(field)))
            return fields === null ? [] : [{ ...right, fields }]
        }),
        tools: spec.grant.tools.filter((tool) => tools.has(tool)),
        effects: spec.grant.effects.filter((effect) => effects.has(effect)),
    }
}
