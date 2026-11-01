/** One stored customer or agent message as a channel page lists it. */
export interface FeedMessage {
    /** The message. */
    readonly id: string
    /** The conversation it belongs to. */
    readonly conversationId: string
    /** `user` or `agent`. */
    readonly role: string
    /** The text. */
    readonly body: string
    /** When it was stored, as the database words it. */
    readonly createdAt: string
    /** `sent`, `failed` or null. */
    readonly deliveryStatus: string | null
    /** The delivery verdict text, or null. */
    readonly deliveryError: string | null
}

/** The verdict of the newest agent reply whose delivery was tried. */
export interface DeliveredReply {
    /** `sent` or `failed`. */
    readonly deliveryStatus: string
    /** The verdict text, or null. */
    readonly deliveryError: string | null
}

/** The delivered reply, or null when no delivery was tried. */
export type OptionalDeliveredReply = DeliveredReply | null

/** When a customer last wrote, or null when they never did. */
export type OptionalCustomerMoment = Date | null

/** When the customer of one conversation last wrote. */
export interface ConversationWrite {
    /** The conversation. */
    readonly conversationId: string
    /** The moment of the last write, as the database words it. */
    readonly lastAt: string
}
