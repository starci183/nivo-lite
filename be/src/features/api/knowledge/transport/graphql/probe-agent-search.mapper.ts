import type { BrainProbeAnswer } from "@modules/domain/native-tools"
import type { ProbeAgentSearchRequest } from "../../application/probe-agent-search.contracts"
import type { AgentSearchProbeType } from "./dto/agent-search-probe.type"
import type { ProbeAgentSearchInput } from "./dto/probe-agent-search.input"

/** Maps the GraphQL input to the request. */
export const toProbeAgentSearchRequest = (workspaceId: string, input: ProbeAgentSearchInput): ProbeAgentSearchRequest => ({
    workspaceId,
    agentId: input.agentId,
    tool: input.tool,
    arguments: input.arguments,
    conversationId: input.conversationId,
})

/** Maps the answer to the GraphQL type. */
export const toAgentSearchProbeType = (result: BrainProbeAnswer): AgentSearchProbeType => ({ ...result })
