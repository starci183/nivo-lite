import type { ChatTypingChannel, ChatTypingSignal } from "@modules/domain/chat-typing"
import type { ChatTypingRequest, SetChatTypingRequest } from "../../application/chat-typing.contracts"
import type { ChatTypingChannelType } from "./dto/chat-typing-channel.type"
import type { ChatTypingSignalType } from "./dto/chat-typing-signal.type"
import type { ChatTypingTargetInput } from "./dto/chat-typing-target.input"
import type { SetChatTypingInput } from "./dto/set-chat-typing.input"

/** Copies validated selectors into the channel request. */
export const toChatTypingRequest = (workspaceId: string, input: ChatTypingTargetInput): ChatTypingRequest => ({
    workspaceId,
    target: { room: input.room, conversationId: input.conversationId },
})

/** Copies validated selectors and the caller's boolean hint into the command request. */
export const toSetChatTypingRequest = (workspaceId: string, input: SetChatTypingInput): SetChatTypingRequest => ({
    workspaceId,
    target: { room: input.target.room, conversationId: input.target.conversationId },
    typing: input.typing,
})

/** The channel descriptor travels without transport-only fields. */
export const toChatTypingChannelType = (channel: ChatTypingChannel): ChatTypingChannelType => ({ ...channel })

/** The signal answer matches the broadcast payload. */
export const toChatTypingSignalType = (signal: ChatTypingSignal): ChatTypingSignalType => ({ ...signal })
