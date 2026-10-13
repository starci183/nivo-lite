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
