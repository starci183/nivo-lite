import type { SendAgentChatRequest, QueuedAgentChatTurn } from "@modules/domain/agent-chat"
import type { SendAgentChatMessageInput } from "./dto/send-agent-chat-message.input"
import type { QueuedAgentChatTurnType } from "./dto/queued-agent-chat-turn.type"

/** Maps the GraphQL input and workspace selector to the request. */
export const toSendAgentChatMessageRequest = (
    workspaceId: string,
    input: SendAgentChatMessageInput,
): SendAgentChatRequest => ({ workspaceId, conversationId: input.conversationId, body: input.body })

/** Maps the application result to the GraphQL contract. */
export const toSendAgentChatMessageType = (result: QueuedAgentChatTurn): QueuedAgentChatTurnType => ({ ...result })
