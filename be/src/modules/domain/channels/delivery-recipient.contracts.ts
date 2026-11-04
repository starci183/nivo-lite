/** The fields of a conversation that say whether a reply has anywhere to go. */
export interface DeliveryRecipient {
    /** The channel the conversation came in on. */
    readonly channel: string
    /** The customer's id on that channel, or null before the customer has one. */
    readonly externalId: string | null
    /** The connection the conversation came in through, or null. */
    readonly connectionId: string | null
}
