/** A lead whose contact identifies a customer. */
export interface LeadLinkSource {
    /** The lead id. */
    readonly id: string
    /** The normalised phone, or null. */
    readonly phone: string | null
    /** The normalised email, or null. */
    readonly email: string | null
}

/** The chat a message to a customer leaves on. */
export interface PushConversation {
    /** The conversation id. */
    readonly id: string
    /** The channel, or null for a conversation without one. */
    readonly channel: string | null
}

/** The chat to write to, or null when the customer has none. */
export type PushTarget = PushConversation | null
