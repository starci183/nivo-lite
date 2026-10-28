import type { ChatTarget } from "@modules/domain/chat-markers"

/** The workspace and target whose typing hint the caller sets. */
export interface ChatTypingRequest {
    /** The selected workspace; the domain proves active membership. */
    readonly workspaceId: string
    /** One room or conversation. */
    readonly target: ChatTarget
}

/** A client may change only its own typing hint. */
export interface SetChatTypingRequest extends ChatTypingRequest {
    /** True refreshes the five-second hint; false clears it. */
    readonly typing: boolean
}
