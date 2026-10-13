import type { ChatReplyProgress } from "@modules/domain/chatreply"
import type { ChatAnswerStatusRequest } from "../../application/chat-answer-status.contracts"
import type { ChatAnswerStatusInput } from "./dto/chat-answer-status.input"
import type { ChatReplyProgressType } from "./dto/chat-reply-progress.type"

/** Maps GraphQL arguments and the workspace selector to the application request. */
export const toChatAnswerStatusRequest = (
    workspaceId: string,
    input: ChatAnswerStatusInput,
): ChatAnswerStatusRequest => ({
    workspaceId,
    workItemId: input.workItemId,
})

/** Maps the domain result to the frontend's pollable progress. */
export const toChatAnswerStatusType = (result: ChatReplyProgress): ChatReplyProgressType => ({
    id: result.id,
    status: result.status,
    messageId: result.messageId,
    delivery: result.delivery,
    errorCode: result.errorCode,
})
