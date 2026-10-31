import type { GraphContext, GraphDocument, GraphGap, GraphNode } from "../agent-graphs.contracts"
import { boundaryFindings, intervalOf, numericFactsOf, topOf } from "./interval.policy"

/** The order the setup chat asks in: one gap per turn, always the first of this list. */
export const GAP_ORDER: ReadonlyArray<GraphGap["code"]> = [
    "boundary",
    "approver_missing",
    "approver_absent",
    "on_timeout",
    "else_unset",
    "approver_no_grant",
]

const gap = (code: GraphGap["code"], nodeKey: string, branchKey: string | null): GraphGap => ({ code, nodeKey, branchKey })

const amountFactOf = (context: GraphContext): string | null =>
    Object.values(context.facts).find((spec) => spec.unit === "vnd")?.key ?? null

const gapsOfNode = (node: GraphNode, context: GraphContext): ReadonlyArray<GraphGap> => {
    const { decide } = node
    if (decide === undefined) return []
    const amount = amountFactOf(context)
    const boundaries = numericFactsOf(decide, context.facts).flatMap((fact) =>
        boundaryFindings(decide, fact).map((finding) => gap("boundary", node.key, finding.after.key)),
    )
    const asked = decide.branches.filter((branch) => branch.then === "ask")
    const approvers = asked.flatMap((branch) => (branch.approver === null ? [] : [{ branch, approver: branch.approver }]))
    return [
        ...boundaries,
        ...asked.filter((branch) => branch.approver === null).map((branch) => gap("approver_missing", node.key, branch.key)),
        ...approvers.filter(({ approver }) => !context.groupHasPeople(approver.group)).map(({ branch }) => gap("approver_absent", node.key, branch.key)),
        ...approvers.filter(({ approver }) => approver.onTimeout.kind === "unset").map(({ branch }) => gap("on_timeout", node.key, branch.key)),
        ...(decide.branches.at(-1)?.when === "else" ? [] : [gap("else_unset", node.key, null)]),
        ...approvers
            .filter(({ branch, approver }) => {
                const interval = amount === null || branch.when === "else" ? null : intervalOf(branch.when, amount)
                return !context.approverCovers(decide.intent, approver.group, interval === null ? null : topOf(interval))
            })
            .map(({ branch }) => gap("approver_no_grant", node.key, branch.key)),
    ]
}

/** Everything still vague in the graph, in the fixed order of `GAP_ORDER`, and within one kind in the order of the nodes. */
export const graphGapsOf = (graph: GraphDocument, context: GraphContext): ReadonlyArray<GraphGap> => {
    const all = graph.nodes.flatMap((node) => gapsOfNode(node, context))
    return GAP_ORDER.flatMap((code) => all.filter((entry) => entry.code === code))
}

/** The one gap the next setup question is about, or null when nothing is vague. */
export const firstGapOf = (graph: GraphDocument, context: GraphContext): GraphGap | null =>
    graphGapsOf(graph, context)[0] ?? null
