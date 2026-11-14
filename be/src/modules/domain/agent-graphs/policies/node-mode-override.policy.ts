import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import type { NodeMode } from "@modules/domain/tools"
import { workflowRefused } from "./workflow-view.policy"

/**
 * The running graph with ONE node's `mode` replaced (nivo-frame `rights` rules 5 + 10: a shop changes a node's mode only on its own graph
 * copy, never by a workspace switch; the tool door reads the mode from the version a run is pinned to). Everything else is the graph as it
 * runs. Refused, typed: a key no node of the graph has (`node`), and an engine control step (`node-control`: the hand-off, the outcome, the
 * list loop declare no mode; their calls are the engine's own). Null when the node already has that mode (nothing to write). Pure.
 */
export const graphWithNodeMode = (
    graph: GraphSpec,
    nodeKey: string,
    mode: NodeMode,
    isControlStep: (step: string) => boolean,
): GraphSpec | null => {
    const node = graph.nodes.find((one) => one.key === nodeKey)
    if (node === undefined) throw workflowRefused("node")
    if (isControlStep(node.step)) throw workflowRefused("node-control")
    if (node.mode === mode) return null
    return { ...graph, nodes: graph.nodes.map((one): GraphSpecNode => (one.key === nodeKey ? { ...one, mode } : one)) }
}
