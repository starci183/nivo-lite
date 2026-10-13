import type { ChatReplyProgress } from "@modules/domain/chatreply"
import type { RequestChatAnswerRequest } from "../../application/request-chat-answer.contracts"
import type { RequestChatAnswerInput } from "./dto/request-chat-answer.input"
import type { ChatReplyProgressType } from "./dto/chat-reply-progress.type"

/** Maps GraphQL arguments and the workspace selector to the application request. */
export const toRequestChatAnswerRequest = (
    workspaceId: string,
    input: RequestChatAnswerInput,
): RequestChatAnswerRequest => ({
    workspaceId,
    workItemId: input.workItemId,
    conversationId: input.conversationId,
    text: input.text,
    locale: input.locale,
})

/** Maps the domain result to the frontend's pollable progress. */
export const toRequestChatAnswerType = (result: ChatReplyProgress): ChatReplyProgressType => ({
    id: result.id,
    status: result.status,
    messageId: result.messageId,
    delivery: result.delivery,
    errorCode: result.errorCode,
})
