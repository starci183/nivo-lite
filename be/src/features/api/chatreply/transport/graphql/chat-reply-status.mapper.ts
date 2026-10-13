import type { ChatReplyProgress } from "@modules/domain/chatreply"
import type { ChatReplyStatusRequest } from "../../application/chat-reply-status.contracts"
import type { ChatReplyStatusInput } from "./dto/chat-reply-status.input"
import type { ChatReplyProgressType } from "./dto/chat-reply-progress.type"

/** Maps GraphQL arguments and the workspace selector to the application request. */
export const toChatReplyStatusRequest = (workspaceId: string, input: ChatReplyStatusInput): ChatReplyStatusRequest => ({
    workspaceId,
    messageId: input.messageId,
})

/** Maps the domain result to the frontend's pollable progress. */
export const toChatReplyStatusType = (result: ChatReplyProgress): ChatReplyProgressType => ({
    id: result.id,
    status: result.status,
    messageId: result.messageId,
    delivery: result.delivery,
    errorCode: result.errorCode,
})
