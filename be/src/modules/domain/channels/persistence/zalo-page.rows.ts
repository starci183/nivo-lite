/** A follower who wrote lately. */
export interface RecipientRow {
    /** The conversation's external id (the Zalo user id, maybe with a timestamp suffix). */
    readonly external_id: string | null
    /** The name on the conversation. */
    readonly visitor_name: string | null
    /** When they last wrote. */
    readonly last_at: string
}

/** One stored message of a Zalo conversation. */
export interface MessageEventRow {
    /** The message id. */
    readonly id: string
    /** `user` or `agent`. */
    readonly role: string
    /** The text. */
    readonly body: string
    /** When it was stored. */
    readonly created_at: string
    /** `sent`, `failed` or null. */
    readonly delivery_status: string | null
    /** The delivery verdict text. */
    readonly delivery_error: string | null
    /** The conversation's customer name. */
    readonly visitor_name: string | null
}

/** One follow event of the OA. */
export interface FollowEventRow {
    /** The inbox row id. */
    readonly id: string
    /** When it was received. */
    readonly received_at: string
}

/** What the inbox knows of a connection. */
export interface InboxFactsRow {
    /** When the latest event arrived. */
    readonly last_at: string | null
    /** A customer text arrived. */
    readonly has_text: boolean
    /** A follow event arrived. */
    readonly has_follow: boolean
}

/** The latest delivery verdict of the agent. */
export interface LastReplyRow {
    /** `sent` or `failed`. */
    readonly delivery_status: string
    /** The verdict text. */
    readonly delivery_error: string | null
}
