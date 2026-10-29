/** One lead as the board and journey read it. */
export interface LeadView {
    /** The lead id. */
    readonly id: string
    /** The customer's name. */
    readonly contact_name: string
    /** The company. */
    readonly company: string
    /** The channel label. */
    readonly channel: string
    /** What the customer needs. */
    readonly need: string
    /** The journey stage. */
    readonly stage: string
    /** The context brief, or null. */
    readonly context_summary: string | null
    /** The agent installation that captured it, when known. */
    readonly installation_id: string | null
    /** The creation time, ISO text. */
    readonly created_at: string
}

/** The contact details of one lead. */
export interface LeadContactView {
    /** The lead id. */
    readonly id: string
    /** The customer's name. */
    readonly contact_name: string
    /** The stored phone, or null. */
    readonly phone: string | null
    /** The stored email, or null. */
    readonly email: string | null
}
