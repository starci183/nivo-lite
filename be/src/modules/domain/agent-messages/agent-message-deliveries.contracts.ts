/** The delivery of one human reply to a customer conversation. */
export interface HumanReplyDelivery {
    /** The stored reply. */
    readonly id: string
    /** How the delivery stands, or null before it was tried. */
    readonly deliveryStatus: string | null
}

/** A human reply, or null when the conversation holds none under the id. */
export type OptionalHumanReplyDelivery = HumanReplyDelivery | null

/** A stored human reply with the conversation it belongs to. */
export interface HumanReplyRecord {
    /** The stored reply. */
    readonly id: string
    /** The conversation the reply belongs to. */
    readonly conversationId: string
    /** How the delivery stands, or null before it was tried. */
    readonly deliveryStatus: string | null
}

/** A human reply of the workspace, or null when there is none under the id. */
export type OptionalHumanReplyRecord = HumanReplyRecord | null
