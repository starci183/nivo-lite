/** The caller whose own lines never count as unread. */
export interface ChatReader {
    /** The caller's account id. */
    readonly userId: string
    /** The caller's display name, which recognises legacy lines that carry no account id. */
    readonly displayName: string
}

/** The caller's read marker of one conversation: when it was read up to (ISO text with microseconds), null while nothing was read. */
export interface ChatMark {
    /** The conversation id. */
    readonly conversationId: string
    /** The instant the caller read up to. */
    readonly readAt: string | null
}

/** The newest line of a conversation. */
export interface ChatNewest {
    /** The line id, the second ordering key. */
    readonly id: string
    /** The text. */
    readonly body: string
    /** The account that wrote it; null for the agent's own lines and unattributed legacy ones. */
    readonly author_user_id: string | null
    /** The name written on the line; null when none was. */
    readonly author_name: string | null
    /** When it was written, ISO 8601 as the database JSON timestamp renders it. */
    readonly at: string
    /** When it was written as sortable text: digits only, fixed width, microsecond exact. */
    readonly sort_at: string
}

/** The unread count and newest line of one conversation. */
export interface ChatActivity {
    /** The conversation id. */
    readonly conversationId: string
    /** Lines the caller has not read, at most 99. */
    readonly unread: number
    /** The newest line; undefined while nobody wrote. */
    readonly newest: ChatNewest | undefined
}
