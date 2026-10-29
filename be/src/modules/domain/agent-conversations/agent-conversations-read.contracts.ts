/** One test chat of an agent. */
export interface TestChatRef {
    /** The conversation id. */
    readonly id: string
    /** The agent being tried out. */
    readonly agentId: string
}

/** A customer conversation as the readers of other capabilities see it. */
export interface CustomerChatRef {
    /** The conversation id. */
    readonly id: string
    /** The customer it belongs to, or null while the visitor is unknown. */
    readonly leadId: string | null
}

/** A customer conversation, or none. */
export type OptionalCustomerChatRef = CustomerChatRef | null

/** The channel text of a conversation, or null when there is none. */
export type OptionalChannelText = string | null

/** A conversation on a connection, as a channel page lists it. */
export interface ConnectionConversation {
    /** The conversation. */
    readonly id: string
    /** The customer's id on the channel, or null. */
    readonly externalId: string | null
    /** The name on the conversation, or null. */
    readonly visitorName: string | null
}
