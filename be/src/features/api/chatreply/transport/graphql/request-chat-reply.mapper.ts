import type { ChatReplyProgress } from "@modules/domain/chatreply"
import type { RequestChatReplyRequest } from "../../application/request-chat-reply.contracts"
import type { RequestChatReplyInput } from "./dto/request-chat-reply.input"
import type { ChatReplyProgressType } from "./dto/chat-reply-progress.type"

/** Maps GraphQL arguments and the workspace selector to the application request. */
export const toRequestChatReplyRequest = (
    workspaceId: string,
    input: RequestChatReplyInput,
): RequestChatReplyRequest => ({
    workspaceId,
    conversationId: input.conversationId,
    body: input.body,
    locale: input.locale,
})

/** Maps the domain result to the frontend's pollable progress. */
export const toRequestChatReplyType = (result: ChatReplyProgress): ChatReplyProgressType => ({
    id: result.id,
    status: result.status,
    messageId: result.messageId,
    delivery: result.delivery,
    errorCode: result.errorCode,
})
