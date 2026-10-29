/** The caller whose own lines never count as unread. */
export interface LineReader {
    /** The caller's account id. */
    readonly userId: string
    /** The caller's display name, which recognises legacy lines that carry no account id. */
    readonly displayName: string
}

/** The instant a conversation was read up to, as the database renders it; null while nothing was read. */
export type ReadInstant = string | null

/** The caller's read marker of one conversation: the key of the conversation and when it was read up to (ISO text with microseconds). */
export interface ReadMark {
    /** The conversation key: a room key or a lead id. */
    readonly key: string
    /** The instant the caller read up to, as the database renders it; null while nothing was read (every line is unread). */
    readonly readAt: ReadInstant
}

/** The unread count and the newest line of a room or of the whole workspace. */
export interface LineActivity {
    /** Lines the caller has not read, at most 99. */
    readonly unread: number
    /** Distinct incoming unread bodies containing @, independent of the badge's count cap. */
    readonly unread_mention_bodies: Array<string>
    /** The newest line's text. */
    readonly last_body: string | null
    /** The newest line's author. */
    readonly last_author: string | null
    /** The newest line's author account; null on a legacy line. */
    readonly last_author_user_id: string | null
    /** When the newest line was written, ISO 8601 as the database JSON timestamp renders it. */
    readonly last_at: string | null
}

/** The unread count of one customer conversation. */
export interface LeadUnread {
    /** The lead id. */
    readonly lead_id: string
    /** Lines the caller has not read, at most 99. */
    readonly unread: number
}

/** The keyset position the thread pages from: the oldest line already seen. */
export interface LineCursor {
    /** When the line was written, ISO text. */
    readonly createdAt: string
    /** The line id. */
    readonly id: string
}

/** What the thread page asks for. */
export interface LinePageQuery {
    /** The room to page; null pages the whole workspace. */
    readonly room: string | null
    /** The position to page before; null starts at the newest line. */
    readonly before: LineCursor | null
    /** How many lines to answer. */
    readonly size: number
}

/** One line of the thread as it is stored. */
export interface ThreadLine {
    /** The message id. */
    readonly id: string
    /** Who wrote it. */
    readonly author_kind: "human" | "agent" | "system"
    /** The author's display name. */
    readonly author_name: string
    /** The account that wrote it; null on a legacy line or a line no member wrote. */
    readonly author_user_id: string | null
    /** The agent that wrote it, when one did. */
    readonly agent_id: string | null
    /** The staff member it was written as, or null for the owner. */
    readonly staff_id: string | null
    /** The text. */
    readonly body: string
    /** The customer it is about. */
    readonly lead_id: string | null
    /** The work item it mirrors. */
    readonly work_item_id: string | null
    /** The Hub room of the line; null is the general Office room. */
    readonly room: string | null
    /** The result card payload as JSON text, when the line is a card. */
    readonly card_json: string | null
    /** When it was written, ISO 8601. */
    readonly created_at: string
}

/** The author and text of one message. */
export interface LineText {
    /** The message id. */
    readonly id: string
    /** Who wrote it. */
    readonly author_kind: "human" | "agent" | "system"
    /** The text. */
    readonly body: string
}

/** The text of a message, or undefined when the workspace has none by that id. */
export type OptionalLineText = LineText | undefined
