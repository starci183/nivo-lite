import { graphRefProblems, graphSpecProblems, isContractProblem, refProblemText, specRefContextOf } from "@nivo-lite/agent-sdk/graph"
import { contractProblemText } from "@nivo-lite/blocks-core/graph"
import { MODULE_DECLARATIONS } from "@nivo-lite/blocks-core/modules"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { NodeIndex } from "@nivo-lite/agent-sdk/node"
import { AgentGraphsError, AgentGraphsErrorCode } from "../errors/agent-graphs.error"
import type { GraphDocument } from "../agent-graphs.contracts"
import { AGENT_GRAPHS_MESSAGES } from "../messages/agent-graphs.messages"
import { toolsOutsideAgent } from "./agent-tools.policy"

/** The text of a value with the keys of every object in order: the database keeps a document with its keys in its own order, so equal content must compare equal. */
const canonicalText = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonicalText).join(",")}]`
    if (value === null || typeof value !== "object") return String(JSON.stringify(value))
    const entries = Object.entries(value)
        .filter(([, member]) => member !== undefined)
        .sort(([left], [right]) => (left < right ? -1 : 1))
    const members = entries.map(([key, member]) => JSON.stringify(key) + ":" + canonicalText(member))
    return "{" + members.join(",") + "}"
}

/** True when a graph already runs this flow, whatever the order of the keys of either. */
export const sameFlow = (held: GraphSpec | undefined, wanted: GraphSpec): boolean =>
    held !== undefined && canonicalText(held) === canonicalText(wanted)

/** True when a graph's flow changes: one is added, dropped, or holds other content. */
export const flowChanged = (held: GraphSpec | undefined, wanted: GraphSpec | undefined): boolean =>
    wanted === undefined ? held !== undefined : !sameFlow(held, wanted)

/** The tool set the module of a flow declares for its agent, or null when the module declares no agent. */
export const agentToolsOf = (moduleKey: string): ReadonlyArray<string> | null =>
    MODULE_DECLARATIONS.find((module) => module.key === moduleKey)?.agent?.tools ?? null

/**
 * Refuses a flow the installed nodes do not take, or whose steps reach a tool outside the tool set of its module's agent
 * (`GRAPH_TOOL_OUTSIDE_AGENT`), naming every problem, with nothing written: the one judgement every road that publishes a flow passes
 * (a member's publish and the seed alike).
 */
export const requireSoundFlow = (flow: GraphSpec, installed: NodeIndex): void => {
    const all = graphSpecProblems(flow, installed)
    // The contract problems are the owner's to fix in the editor: refused with their own words, each one named.
    const contract = all.filter(isContractProblem)
    const [first] = contract
    if (first !== undefined) {
        throw new AgentGraphsError({
            code: AgentGraphsErrorCode.ContractRefused,
            params: { count: String(contract.length), first: contractProblemText(first, "vi"), problems: JSON.stringify(contract) },
        })
    }
    const problems = [...all, ...toolsOutsideAgent(flow, installed, agentToolsOf(flow.moduleKey))]
    if (problems.length > 0) {
        const listed = problems.map((problem) => `${problem.code} ${problem.at}`).join(", ")
        throw new AgentGraphsError({ code: AgentGraphsErrorCode.PublishRefused, params: { problems: listed } })
    }
    requireSoundRefs(flow, installed)
}

/**
 * Refuses a version whose params or refs are broken, by `graphRefProblems`: every problem in `problems` as JSON (code, node, field, ref,
 * i18n key and its fill-ins) for the editor to word in place, the first one worded in Vietnamese in `first`.
 */
export const requireSoundRefs = (flow: GraphSpec, installed: NodeIndex): void => {
    const problems = graphRefProblems(flow, specRefContextOf(flow, installed))
    const [first] = problems
    if (first === undefined) return
    throw new AgentGraphsError({
        code: AgentGraphsErrorCode.RefsRefused,
        params: { count: String(problems.length), first: refProblemText(first, AGENT_GRAPHS_MESSAGES.vi), problems: JSON.stringify(problems) },
    })
}
/** True for a graph that holds a flow and none of the old nodes: the flow runs the agent, so the old walk has nothing to judge and must not answer for it. */
export const isFlowOnly = (document: GraphDocument): boolean =>
    document.flow !== undefined && document.nodes.length === 0
