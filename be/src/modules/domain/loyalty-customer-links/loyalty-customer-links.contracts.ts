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

/** The chat a customer writes in, as a turn knows it. */
export interface ChatCustomerRef {
    /** The workspace. */
    readonly workspaceId: string
    /** The conversation. */
    readonly conversationId: string
    /** The lead of the conversation, or null. */
    readonly leadId: string | null
    /** The channel of the conversation (telegram, zalo, website...). */
    readonly channel: string
    /** The customer's id on the channel, or null. */
    readonly externalId: string | null
}

/** The customer id, or null when the chat is not linked to a member. */
export type ChatCustomerId = string | null
