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
