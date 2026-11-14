import type { GraphSpec, GraphSpecGrant, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import type { NodeIndex } from "@nivo-lite/agent-sdk/node"
import { installedStepIn } from "@modules/domain/installed-plugins"
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

const grantUnion = (left: GraphSpecGrant, right: GraphSpecGrant): GraphSpecGrant => ({
    tools: [...union(left.tools, right.tools)],
    effects: [...union(left.effects, right.effects)],
})

/**
 * The grant of a graph cut to what its installed steps need: the effects and the tools it uses (there is no data right,
 * `nivo-frame.rights`). Each step is read through the one installed-step view (`installedStepIn`), so a template node counts as a
 * `defineNode` node does: its calls are the grant's TOOLS (each call of a template node is a tool call, an effect id included, as the
 * adapter derives its grant), a `defineNode` node's are its effects and its tools. A tool or effect the grant does not hold is never
 * added, so the cut never widens the agent.
 */
export const minimumGrantOf = (spec: GraphSpec, index: NodeIndex): GraphSpecGrant => {
    const steps = spec.nodes.flatMap((node) => {
        const step = installedStepIn(index.nodes, node.step)
        return step === null ? [] : [step]
    })
    const effects = new Set<string>(steps.flatMap((step) => (step.form === "node" ? step.effects : [])))
    const tools = new Set<string>(
        steps.flatMap((step) => (step.form === "template" ? step.tools : step.tools.filter((call) => !step.effects.includes(call)))),
    )
    return {
        tools: spec.grant.tools.filter((tool) => tools.has(tool)),
        effects: spec.grant.effects.filter((effect) => effects.has(effect)),
    }
}
