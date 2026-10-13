/** The id an insert answers. */
export interface MessageIdRow {
    /** The message id. */
    readonly id: string
}

/** A stored message as FIND_MESSAGE and FIND_AGENT_REPLY select it; the reply lookup carries no role. */
export interface StoredMessageRow {
    /** The message id. */
    readonly id: string
    /** Who said it, when the statement selects it. */
    readonly role?: string
    /** What was said. */
    readonly body: string
    /** `sent` or `failed` once a delivery was tried. */
    readonly delivery_status: string | null
}

/** One transcript line. */
export interface TranscriptRow {
    /** Who said it. */
    readonly role: string
    /** What was said. */
    readonly body: string
}

/** The time of the customer's last message. */
export interface LastMessageRow {
    /** When it was written, ISO 8601. */
    readonly created_at: string
}

/** A row in the agent chat thread. */
export interface ChatMessageRow {
    /** The message. */
    readonly id: string
    /** The stored speaker. */
    readonly role: string
    /** The message text. */
    readonly body: string
    /** Creation instant as text. */
    readonly created_at: string
}
