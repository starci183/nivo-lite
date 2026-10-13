import type { AgentChatPageRequest, AgentChatPageData } from "@modules/domain/agent-chat"
import type { AgentChatPageInput } from "./dto/agent-chat-page.input"
import type { AgentChatPageType } from "./dto/agent-chat-page.type"

/** Maps the GraphQL input and workspace selector to the request. */
export const toGetAgentChatPageRequest = (workspaceId: string, input: AgentChatPageInput): AgentChatPageRequest => ({
    workspaceId,
    agentId: input.agentId,
    welcome: input.welcome,
})

/** Maps the application result to the GraphQL contract. */
export const toGetAgentChatPageType = (result: AgentChatPageData): AgentChatPageType => ({ ...result })
