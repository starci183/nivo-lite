/** One message a customer said, with the time they said it. */
export interface CustomerLine {
    /** The message. */
    readonly id: string
    /** What they said. */
    readonly body: string
    /** When they said it. */
    readonly at: Date
}

/** One stored message of a conversation. */
export interface StoredMessage {
    /** The message id. */
    readonly id: string
    /** Who said it: user, agent or system. */
    readonly role: string
    /** What was said. */
    readonly body: string
    /** `sent` or `failed` once a delivery was tried, null before. */
    readonly deliveryStatus: string | null
}

/** The reply stored for one customer message. */
export interface StoredReply {
    /** The reply message id. */
    readonly id: string
    /** The text that was stored, which is the earlier attempt's text when the reply already existed. */
    readonly body: string
    /** True when the reply already reached the customer. */
    readonly sent: boolean
}

/** One line of the transcript, without system lines. */
export interface TranscriptLine {
    /** Who said it. */
    readonly role: "user" | "agent"
    /** What was said. */
    readonly body: string
}

/** A message the agent chat thread displays. */
export interface AgentThreadMessage {
    /** The message. */
    readonly id: string
    /** User, agent or system. */
    readonly role: "user" | "agent" | "system"
    /** The message text. */
    readonly body: string
    /** Creation instant, ISO 8601. */
    readonly createdAt: string
}

/** The stable message id of an approved work item, or null for a newly generated id. */
export type ApprovedMessageId = string | null

/** The final reply body already persisted for an item or customer message, or null before one exists. */
export type StoredReplyBody = string | null

/** The proven workspace account that typed a message, or null for channel and automated messages. */
export type AuthorUserId = string | null

/** The messages customers wrote on one channel on one Vietnam day. */
export interface CustomerMessagesDay {
    /** The channel (`facebook`, `zalo`). */
    readonly channel: string
    /** The day, `YYYY-MM-DD`. */
    readonly day: string
    /** How many messages customers wrote. */
    readonly messages: number
}

/** The messages customers wrote in one conversation on one Vietnam day. */
export interface ConversationDayCount {
    /** The conversation. */
    readonly conversationId: string
    /** The day, `YYYY-MM-DD`. */
    readonly day: string
    /** How many messages customers wrote. */
    readonly messages: number
}

/** Whether the stored message grants one outbound attempt, or already holds a delivery fact. */
export type DeliveryClaim = "send" | "acknowledged" | "ambiguous" | "missing"

/** One message of a conversation as a graph node reads it. */
export interface NodeMessage {
    /** The message id. */
    readonly id: string
    /** The conversation. */
    readonly conversationId: string
    /** Who wrote it: the author kind when stored, else the role. */
    readonly authorKind: string
    /** The text. */
    readonly body: string
    /** Creation instant, ISO 8601. */
    readonly createdAt: string
}

/** When a message happened, if that is not when it was stored: the event's own time, and a tie-break for messages of the same millisecond. */
export interface MessageStamp {
    /** The time the message happened, never later than when it was stored. */
    readonly at: Date
    /** Microseconds added to `at`, 0 to 999: a stable order for messages that share a millisecond. */
    readonly tieMicros: number
}
