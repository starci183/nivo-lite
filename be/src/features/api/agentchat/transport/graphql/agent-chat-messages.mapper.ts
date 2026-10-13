import type { AgentChatConversationRequest, AgentChatMessages } from "@modules/domain/agent-chat"
import type { AgentChatMessagesInput } from "./dto/agent-chat-messages.input"
import type { AgentChatMessageType } from "./dto/agent-chat-message.type"

/** Maps the GraphQL input and workspace selector to the request. */
export const toListAgentChatMessagesRequest = (
    workspaceId: string,
    input: AgentChatMessagesInput,
): AgentChatConversationRequest => ({ workspaceId, conversationId: input.conversationId })

/** Maps the application result to the GraphQL contract. */
export const toListAgentChatMessagesType = (result: AgentChatMessages): Array<AgentChatMessageType> =>
    result.map((item) => ({ ...item }))
