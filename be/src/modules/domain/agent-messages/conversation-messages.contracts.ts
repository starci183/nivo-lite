/** A bounded message read used by a workbench whose composer proved workspace membership. */
export interface ConversationMessagesQuery {
    /** Only messages at or after this timestamp, when set. */
    readonly since?: string
    /** The maximum number of rows. */
    readonly limit: number
    /** Oldest first, when computing a conversation's first reply time. */
    readonly oldestFirst?: boolean
}
