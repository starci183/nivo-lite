import type { ChatHandlingResult } from "@modules/domain/chatreply"
import type { SetChatHandlingRequest } from "../../application/set-chat-handling.contracts"
import type { SetChatHandlingInput } from "./dto/set-chat-handling.input"
import type { ChatHandlingType } from "./dto/chat-handling.type"

/** Maps GraphQL arguments and the workspace selector to the application request. */
export const toSetChatHandlingRequest = (workspaceId: string, input: SetChatHandlingInput): SetChatHandlingRequest => ({
    workspaceId,
    conversationId: input.conversationId,
    takeOver: input.takeOver,
    locale: input.locale,
})

/** Maps the domain result to the frontend's handling result. */
export const toSetChatHandlingType = (result: ChatHandlingResult): ChatHandlingType => ({
    conversationId: result.conversationId,
    handledBy: result.handledBy,
})
