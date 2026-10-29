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

/** The channel a customer conversation runs on. */
export interface ConversationChannel {
    /** The conversation. */
    readonly id: string
    /** Its channel. */
    readonly channel: string
}

/** A customer conversation as the inbox of a workbench reads it, under its stored column names. */
export interface CustomerConversationRow {
    /** The conversation. */
    readonly id: string
    /** The channel. */
    readonly channel: string
    /** The name on the conversation, or null. */
    readonly visitor_name: string | null
    /** The lead, or null. */
    readonly lead_id: string | null
    /** The staff member handling it, or null. */
    readonly handled_by: string | null
    /** When it was taken over, or null. */
    readonly handled_at: Date | string | null
    /** The customer's id on the channel, or null. */
    readonly external_id: string | null
    /** When it began. */
    readonly created_at: Date | string
}

/** A customer conversation, or null when the workspace has none under the id. */
export type OptionalCustomerConversationRow = CustomerConversationRow | null
