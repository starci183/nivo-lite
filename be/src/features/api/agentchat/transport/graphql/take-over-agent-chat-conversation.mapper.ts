import type { TakeOverAgentChatRequest, AgentChatHolder } from "@modules/domain/agent-chat"
import type { TakeOverAgentChatConversationInput } from "./dto/take-over-agent-chat-conversation.input"
import type { AgentChatHolderType } from "./dto/agent-chat-holder.type"

/** Maps the GraphQL input and workspace selector to the request. */
export const toTakeOverAgentChatConversationRequest = (
    workspaceId: string,
    input: TakeOverAgentChatConversationInput,
): TakeOverAgentChatRequest => ({
    workspaceId,
    conversationId: input.conversationId,
    take: input.take,
    line: input.line,
})

/** Maps the application result to the GraphQL contract. */
export const toTakeOverAgentChatConversationType = (result: AgentChatHolder): AgentChatHolderType => ({ ...result })
