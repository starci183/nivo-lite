/** The agent facts not present in the reusable public profile. */
export interface ChatAgentRow {
    /** The agent. */
    readonly id: string
    /** Its module. */
    readonly module: string
    /** Active or paused. */
    readonly status: string
    /** The opening greeting. */
    readonly greeting: string
}

/** Proof of a purchase inside the founding offer window. */
export interface FoundingPurchaseRow {
    /** The qualifying event. */
    readonly id: string
}

/** The submitted chat message and its stored reply's delivery verdict. */
export interface ChatTurnMessageRow {
    /** The submitted message. */
    readonly id: string
    /** The containing conversation. */
    readonly conversation_id: string
    /** Website threads are delivered by persisting the reply for the page. */
    readonly channel: string
    /** User or agent; agent messages enqueue delivery. */
    readonly role: string
    /** The submitted human reply's delivery verdict. */
    readonly delivery_status: string | null
    /** The reply stored for a user message, when any. */
    readonly reply_id: string | null
    /** The reply's delivery verdict. */
    readonly reply_delivery_status: string | null
}
