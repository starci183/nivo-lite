import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { NodeIndex } from "@nivo-lite/agent-sdk/node"

/** The code of a step whose tool lies outside the tool set of its module's agent. */
export const GRAPH_TOOL_OUTSIDE_AGENT = "GRAPH_TOOL_OUTSIDE_AGENT"

/** One tool a step of a workflow may call although the agent of the workflow's module does not hold it. */
export interface ToolOutsideAgent {
    /** The code of the problem. */
    readonly code: typeof GRAPH_TOOL_OUTSIDE_AGENT
    /** Where it is: the key of the graph node, then the tool. */
    readonly at: string
}

/**
 * The tools of a workflow's steps that lie outside the tool set of its module's agent: the second of the two rights (a step may call
 * only what its agent may ever use). A step's tools are the effects and the tools its node declares. `agentTools` is the set the module
 * declares for its agent; null (the module declares no agent) judges nothing, since there is no set to hold a step to.
 */
export const toolsOutsideAgent = (
    flow: GraphSpec,
    installed: NodeIndex,
    agentTools: ReadonlyArray<string> | null,
): ReadonlyArray<ToolOutsideAgent> => {
    if (agentTools === null) return []
    const held = new Set(agentTools)
    return flow.nodes.flatMap((node) => {
        const definition = installed.nodes.get(node.step)
        const reach = [...new Set([...(definition?.effects ?? []), ...(definition?.tools ?? [])])]
        return reach
            .filter((tool) => !held.has(tool))
            .map((tool): ToolOutsideAgent => ({ code: GRAPH_TOOL_OUTSIDE_AGENT, at: `${node.key}:${tool}` }))
    })
}
