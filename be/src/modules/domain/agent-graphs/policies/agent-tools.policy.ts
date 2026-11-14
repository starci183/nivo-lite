import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { NodeIndex } from "@nivo-lite/agent-sdk/node"
import { DEFAULT_AI_READ_TOOLS, DEFAULT_NODE_TOOLS } from "@nivo-lite/agent-sdk/names"
import { DEFAULT_READ_TOOLS } from "@modules/domain/context-sources"
import { installedStepIn } from "@modules/domain/installed-plugins"

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
 * only what its agent may ever use). A step's tools are the effects and the tools its node declares; a CONTROL step's own effects (the
 * hand-off's tag) are the engine's, granted by the step itself, and are not judged. `agentTools` is the set the module declares for its
 * agent, which holds the default reads too (`withDefaultReads`); null (the module declares no agent) judges nothing, since there is no
 * set to hold a step to.
 */
export const toolsOutsideAgent = (
    flow: GraphSpec,
    installed: NodeIndex,
    agentTools: ReadonlyArray<string> | null,
): ReadonlyArray<ToolOutsideAgent> => {
    if (agentTools === null) return []
    const held = new Set(withDefaultReads(agentTools))
    return flow.nodes.flatMap((node) => {
        const definition = installed.nodes.get(node.step)
        if (installedStepIn(installed.nodes, node.step)?.control === true) return []
        const reach = [...new Set([...(definition?.effects ?? []), ...(definition?.tools ?? [])])]
        return reach
            .filter((tool) => !held.has(tool))
            .map((tool): ToolOutsideAgent => ({ code: GRAPH_TOOL_OUTSIDE_AGENT, at: `${node.key}:${tool}` }))
    })
}

/**
 * An agent's tool set as it holds it: the set its module declares, every default read of the registered context sources (the second
 * brain's search, `nivo.conversation.*`, `nivo.lead.*`), the read-context tools every AI step holds (`DEFAULT_AI_READ_TOOLS`) and the
 * record and file tools every node holds (`DEFAULT_NODE_TOOLS`), in the declared order then the defaults' order, each once: what an AI
 * step is SHOWN (the agent's set, the same for every step). The door still locks the context reads to the run's own conversation and
 * customer, and the record tools reach the calling agent's own records only.
 */
export const withDefaultReads = (declared: ReadonlyArray<string>): ReadonlyArray<string> => [
    ...new Set([...declared, ...DEFAULT_READ_TOOLS, ...DEFAULT_AI_READ_TOOLS, ...DEFAULT_NODE_TOOLS]),
]
