import type { GraphNode } from "../agent-graphs.contracts"

/** The keys a node leads to. */
export const successorsOf = (node: GraphNode): ReadonlyArray<string> => {
    if (node.decide !== undefined) return node.decide.branches.map((branch) => branch.next)
    return node.next
}
