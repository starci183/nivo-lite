/** The workspace and room whose typing hint the caller sets. */
export interface ChatTypingRequest {
    /** The selected workspace; the domain proves the caller sits in the room. */
    readonly workspaceId: string
    /** The team-chat room. */
    readonly roomId: string
}

/** A client may change only its own typing hint. */
export interface SetChatTypingRequest extends ChatTypingRequest {
    /** True refreshes the five-second hint; false clears it. */
    readonly typing: boolean
}
