import type { ChatTypingSignal } from "@modules/domain/chat-typing"
import type { SetChatTypingRequest } from "../../application/chat-typing.contracts"
import type { ChatTypingSignalType } from "./dto/chat-typing-signal.type"
import type { SetChatTypingInput } from "./dto/set-chat-typing.input"

/** Copies validated selectors and the caller's boolean hint into the command request. */
export const toSetChatTypingRequest = (workspaceId: string, input: SetChatTypingInput): SetChatTypingRequest => ({
    workspaceId,
    target: { room: input.target.room, conversationId: input.target.conversationId },
    typing: input.typing,
})

/** The signal answer matches the broadcast payload. */
export const toChatTypingSignalType = (signal: ChatTypingSignal): ChatTypingSignalType => ({ ...signal })
