import type { GraphDocument } from "../agent-graphs.contracts"
import { successorsOf } from "./graph-problems.policy"

/**
 * The graph without the stops a seed drew that nothing leads to. An owner cannot remove a seeded node, and the stop would refuse every
 * publish, so a stored draft reads without it.
 */
export const withoutStrayStops = (graph: GraphDocument): GraphDocument => {
    const reached = new Set(graph.nodes.flatMap(successorsOf))
    return { ...graph, nodes: graph.nodes.filter((node) => !node.key.startsWith("stop:") || reached.has(node.key)) }
}
