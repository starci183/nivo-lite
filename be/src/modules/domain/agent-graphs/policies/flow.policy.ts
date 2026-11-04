import { graphSpecProblems } from "@nivo-lite/agent-sdk/graph"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { NodeIndex } from "@nivo-lite/agent-sdk/node"
import { AgentGraphsError, AgentGraphsErrorCode } from "../errors/agent-graphs.error"
import type { GraphDocument } from "../agent-graphs.contracts"

/** The text of a value with the keys of every object in order: the database keeps a document with its keys in its own order, so equal content must compare equal. */
const canonicalText = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonicalText).join(",")}]`
    if (value === null || typeof value !== "object") return String(JSON.stringify(value))
    const entries = Object.entries(value)
        .filter(([, member]) => member !== undefined)
        .sort(([left], [right]) => (left < right ? -1 : 1))
    return `{${entries.map(([key, member]) => `${JSON.stringify(key)}:${canonicalText(member)}`).join(",")}}`
}

/** True when a graph already runs this flow, whatever the order of the keys of either. */
export const sameFlow = (held: GraphSpec | undefined, wanted: GraphSpec): boolean =>
    held !== undefined && canonicalText(held) === canonicalText(wanted)

/** True when a graph's flow changes: one is added, dropped, or holds other content. */
export const flowChanged = (held: GraphSpec | undefined, wanted: GraphSpec | undefined): boolean =>
    wanted === undefined ? held !== undefined : !sameFlow(held, wanted)

/**
 * Refuses a flow the installed nodes do not take, naming every problem, with nothing written: the one judgement every road that
 * publishes a flow passes (a member's publish and the seed alike).
 */
export const requireSoundFlow = (flow: GraphSpec, installed: NodeIndex): void => {
    const problems = graphSpecProblems(flow, installed)
    if (problems.length === 0) return
    const listed = problems.map((problem) => `${problem.code} ${problem.at}`).join(", ")
    throw new AgentGraphsError({ code: AgentGraphsErrorCode.PublishRefused, params: { problems: listed } })
}
/** True for a graph that holds a flow and none of the old nodes: the flow runs the agent, so the old walk has nothing to judge and must not answer for it. */
export const isFlowOnly = (document: GraphDocument): boolean =>
    document.flow !== undefined && document.nodes.length === 0
