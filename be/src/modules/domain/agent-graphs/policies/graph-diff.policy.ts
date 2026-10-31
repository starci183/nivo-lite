import type { DataRight } from "@modules/domain/mcp-gateway"
import type { DiffChange, GraphBranch, GraphDiff, GraphDocument, GraphNode } from "../agent-graphs.contracts"
import { intervalOf, topOf } from "./interval.policy"

/** Who makes the change and which numeric fact the boundaries are read on. */
export interface DiffContext {
    /** The member publishing; naming yourself as approver counts as widening. */
    readonly actorMemberId: string | null
    /** The amount fact whose bounds are compared. */
    readonly amountFact: string
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
    before: GraphBranch | undefined,
    after: GraphBranch,
    context: DiffContext,
): ReadonlyArray<DiffChange> => {
    const selfApprover =
        context.actorMemberId !== null &&
        after.approver?.group.members.includes(context.actorMemberId) === true &&
        before?.approver?.group.members.includes(context.actorMemberId) !== true
    const selfChange = selfApprover ? [change("self_approver", nodeKey, after.key)] : []
    if (after.then !== "auto") return selfChange
    if (before?.then !== "auto") return [...selfChange, change("branch_more_auto", nodeKey, after.key)]
    const raised = topWord(after, context.amountFact) > topWord(before, context.amountFact)
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
    const branches = branchesOf(after).flatMap((branch) =>
        branchChanges(
            after.key,
            branchesOf(before).find((entry) => entry.key === branch.key),
            branch,
            context,
        ),
    )
    return [...tools, ...branches]
}

const scopeRank = (scope: DataRight["scope"]): number => (scope === "workspace" ? 1 : 0)

const rightChanges = (before: GraphDocument, after: GraphDocument): ReadonlyArray<DiffChange> =>
    after.rights.flatMap((right) => {
        const old = before.rights.find((entry) => entry.kind === right.kind)
        if (old === undefined) return [change("right_added", null, null)]
        const wider =
            scopeRank(right.scope) > scopeRank(old.scope) ||
            old.hide.some((field) => !right.hide.includes(field)) ||
            old.mask.some((field) => !right.mask.includes(field) && !right.hide.includes(field))
        return wider ? [change("right_widened", null, null)] : []
    })

/**
 * What a change does to the agent's reach. It widens when any path became more permissive (a branch that now runs alone, a
 * raised boundary), a tool was added, the publisher named themselves as an approver, or a data right was added or widened. A
 * tightening is never a widening, so a manager may publish it.
 */
export const graphDiff = (before: GraphDocument, after: GraphDocument, context: DiffContext): GraphDiff => {
    const old = new Map(before.nodes.map((node) => [node.key, node]))
    const changes = [
        ...after.nodes.flatMap((node) => nodeChanges(old.get(node.key), node, context)),
        ...rightChanges(before, after),
    ]
    return { widens: changes.length > 0, changes }
}
