import type {
    DiffChange,
    FactRegistry,
    GraphBranch,
    GraphDiff,
    GraphDocument,
    GraphNode,
} from "../agent-graphs.contracts"
import { amountFactOf, intervalOf, topOf } from "./interval.policy"

/** Who makes the change and the facts the boundaries of each decide point are read on. */
export interface DiffContext {
    /** The member publishing; naming yourself as approver counts as widening. */
    readonly actorMemberId: string | null
    /** The registry of facts: each decide point compares the bounds of its own amount fact. */
    readonly facts: FactRegistry
}

const change = (kind: DiffChange["kind"], nodeKey: string | null, branchKey: string | null): DiffChange => ({
    kind,
    nodeKey,
    branchKey,
})

const branchesOf = (node: GraphNode | undefined): ReadonlyArray<GraphBranch> => node?.decide?.branches ?? []

const topWord = (branch: GraphBranch, fact: string): number => {
    const interval = intervalOf(branch.when, fact)
    const top = interval === null ? null : topOf(interval)
    return top === null ? Number.POSITIVE_INFINITY : top
}

const branchChanges = (
    nodeKey: string,
    amountFact: string,
    before: GraphBranch | undefined,
    after: GraphBranch,
    context: DiffContext,
): ReadonlyArray<DiffChange> => {
    const selfApprover =
        context.actorMemberId !== null &&
        after.approver?.group.members.includes(context.actorMemberId) === true &&
        before?.approver?.group.members.includes(context.actorMemberId) !== true
    const selfChange = selfApprover ? [change("self_approver", nodeKey, after.key)] : []
    if (after.mode !== "auto") return selfChange
    if (before?.mode !== "auto") return [...selfChange, change("branch_more_auto", nodeKey, after.key)]
    const raised = topWord(after, amountFact) > topWord(before, amountFact)
    return raised ? [...selfChange, change("boundary_raised", nodeKey, after.key)] : selfChange
}

const nodeChanges = (
    before: GraphNode | undefined,
    after: GraphNode,
    context: DiffContext,
): ReadonlyArray<DiffChange> => {
    const known = new Set((before?.uses ?? []).map((use) => use.tool))
    const tools = after.uses
        .filter((use) => use.tool !== null && !known.has(use.tool))
        .map(() => change("tool_added", after.key, null))
    const amountFact = after.decide === undefined ? "" : (amountFactOf(after.decide, context.facts) ?? "")
    const branches = branchesOf(after).flatMap((branch) =>
        branchChanges(
            after.key,
            amountFact,
            branchesOf(before).find((entry) => entry.key === branch.key),
            branch,
            context,
        ),
    )
    return [...tools, ...branches]
}

/**
 * What a change does to the agent's reach. It widens when any path became more permissive (a branch that now runs alone, a
 * raised boundary), a tool was added or the publisher named themselves as an approver. A
 * tightening is never a widening, so a manager may publish it.
 */
export const graphDiff = (before: GraphDocument, after: GraphDocument, context: DiffContext): GraphDiff => {
    const old = new Map(before.nodes.map((node) => [node.key, node]))
    const changes = [...after.nodes.flatMap((node) => nodeChanges(old.get(node.key), node, context))]
    return { widens: changes.length > 0, changes }
}
