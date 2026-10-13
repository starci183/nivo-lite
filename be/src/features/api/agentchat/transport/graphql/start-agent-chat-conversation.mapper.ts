import type { StartAgentChatRequest } from "@modules/domain/agent-chat"
import type { StartAgentChatConversationInput } from "./dto/start-agent-chat-conversation.input"
import type { CreatedAgentChatConversationType } from "./dto/created-agent-chat-conversation.type"

/** Maps the GraphQL input and workspace selector to the request. */
export const toStartAgentChatConversationRequest = (
    workspaceId: string,
    input: StartAgentChatConversationInput,
): StartAgentChatRequest => ({
    workspaceId,
    agentId: input.agentId,
    kind: input.kind,
    visitorName: input.visitorName,
})

/** Maps the application result to the GraphQL contract. */
export const toStartAgentChatConversationType = (result: string): CreatedAgentChatConversationType => ({ id: result })
