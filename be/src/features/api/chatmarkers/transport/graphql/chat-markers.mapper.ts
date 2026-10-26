import type { ChatMarkerRequest, ChatMuteRequest, ChatReceiptRequest } from "../../application/chat-markers.contracts"
import type { ChatMarkerAckType } from "./dto/chat-marker-ack.type"
import type { ChatMuteInput } from "./dto/chat-mute.input"
import type { ChatReceiptInput } from "./dto/chat-receipt.input"
import type { ChatTargetInput } from "./dto/chat-target.input"

/** Adds the selected workspace to one explicit target. */
export const toChatMarkerRequest = (workspaceId: string, input: ChatTargetInput): ChatMarkerRequest => ({
    workspaceId,
    target: { room: input.room, conversationId: input.conversationId },
})

/** Adds a persisted-message receipt to the selected target. */
export const toChatReceiptRequest = (workspaceId: string, input: ChatReceiptInput): ChatReceiptRequest => ({
    workspaceId,
    target: { room: input.room, conversationId: input.conversationId },
    messageId: input.messageId,
})

/** Adds the caller's new preference to the selected target. */
export const toChatMuteRequest = (workspaceId: string, input: ChatMuteInput): ChatMuteRequest => ({
    workspaceId,
    target: { room: input.room, conversationId: input.conversationId },
    muted: input.muted,
})

/** Acknowledges a completed write. */
export const toChatMarkerAckType = (): ChatMarkerAckType => ({ ok: true })
