import type { AgentKnowledgeOverview } from "@modules/domain/agents"
import type { GetAgentKnowledgeRequest } from "../../application/get-agent-knowledge.contracts"
import type { AgentIdInput } from "./dto/agent-id.input"
import type { AgentKnowledgeType } from "./dto/agent-knowledge.type"

/** Maps the agent of the GraphQL input, with the workspace of the call, to the request. */
export const toAgentKnowledgeRequest = (workspaceId: string, input: AgentIdInput): GetAgentKnowledgeRequest => ({
    workspaceId,
    agentId: input.agentId,
})

/** Maps what the agent reads to the GraphQL type. */
export const toAgentKnowledgeType = (overview: AgentKnowledgeOverview): AgentKnowledgeType => ({
    ...overview,
    layers: [...overview.layers],
    documents: [...overview.documents],
    ownFacts: [...overview.ownFacts],
})
