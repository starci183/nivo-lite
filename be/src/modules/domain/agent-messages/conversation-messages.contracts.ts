/** A bounded message read used by a workbench whose composer proved workspace membership. */
export interface ConversationMessagesQuery {
    /** Only messages at or after this timestamp, when set. */
    readonly since?: string
    /** The maximum number of rows. */
    readonly limit: number
    /** Oldest first, when computing a conversation's first reply time. */
    readonly oldestFirst?: boolean
}

/** One message of a selected conversation, as a workbench reads it. */
export interface ConversationMessage {
    /** The conversation. */
    readonly conversation_id: string
    /** Who said it. */
    readonly role: string
    /** What was said. */
    readonly body: string
    /** When it was stored, ISO. */
    readonly created_at: string
}
