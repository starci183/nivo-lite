import type { AgentChatAgentRequest, AgentChatConversations } from "@modules/domain/agent-chat"
import type { AgentChatConversationsInput } from "./dto/agent-chat-conversations.input"
import type { AgentChatConversationType } from "./dto/agent-chat-conversation.type"

/** Maps the GraphQL input and workspace selector to the request. */
export const toListAgentChatConversationsRequest = (
    workspaceId: string,
    input: AgentChatConversationsInput,
): AgentChatAgentRequest => ({ workspaceId, agentId: input.agentId })

/** Maps the application result to the GraphQL contract. */
export const toListAgentChatConversationsType = (result: AgentChatConversations): Array<AgentChatConversationType> =>
    result.map((item) => ({ ...item }))
