import type { GraphContext, GraphDocument, GraphGap, GraphNode } from "../agent-graphs.contracts"
import { boundaryFindings, numericFactsOf } from "./interval.policy"

/** The order the gaps of a graph are listed in. */
export const GAP_ORDER: ReadonlyArray<GraphGap["code"]> = ["boundary", "approver_missing", "on_timeout", "else_unset"]

const gap = (code: GraphGap["code"], nodeKey: string, branchKey: string | null): GraphGap => ({
    code,
    nodeKey,
    branchKey,
})

const gapsOfNode = (node: GraphNode, context: GraphContext): ReadonlyArray<GraphGap> => {
    const { decide } = node
    if (decide === undefined) return []
    const boundaries = numericFactsOf(decide, context.facts).flatMap((fact) =>
        boundaryFindings(decide, fact).map((finding) => gap("boundary", node.key, finding.after.key)),
    )
    const asked = decide.branches.filter((branch) => branch.mode === "ask")
    const approvers = asked.flatMap((branch) =>
        branch.approver === null ? [] : [{ branch, approver: branch.approver }],
    )
    return [
        ...boundaries,
        ...asked
            .filter((branch) => branch.approver === null)
            .map((branch) => gap("approver_missing", node.key, branch.key)),
        ...approvers
            .filter(({ approver }) => approver.onTimeout.kind === "unset")
            .map(({ branch }) => gap("on_timeout", node.key, branch.key)),
        ...(decide.branches.at(-1)?.when === "else" ? [] : [gap("else_unset", node.key, null)]),
    ]
}

/** Everything still vague in the graph, in the fixed order of `GAP_ORDER`, and within one kind in the order of the nodes. */
export const graphGapsOf = (graph: GraphDocument, context: GraphContext): ReadonlyArray<GraphGap> => {
    const all = graph.nodes.flatMap((node) => gapsOfNode(node, context))
    return GAP_ORDER.flatMap((code) => all.filter((entry) => entry.code === code))
}
