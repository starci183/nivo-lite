/** One public.leads row as the public API reads it. */
export interface LeadsRow {
    /** The customer id. */
    readonly id: string
    /** The customer's name. */
    readonly contact_name: string
    /** The company, empty when unknown. */
    readonly company: string
    /** The channel the customer came through. */
    readonly channel: string
    /** What the customer needs. */
    readonly need: string
    /** The stage of the deal. */
    readonly stage: string
    /** The normalised phone, or null. */
    readonly phone: string | null
    /** The normalised email, or null. */
    readonly email: string | null
    /** When the customer was created, ISO 8601 as the select formats it. */
    readonly created_at: string
}

/** One public.events row as the public API reads it. */
export interface EventsRow {
    /** The event id. */
    readonly id: string
    /** The event kind, e.g. api.lead. */
    readonly kind: string
    /** Who did it. */
    readonly actor: string
    /** One line telling what happened. */
    readonly summary: string
    /** The evidence clipped by the select, or null. */
    readonly evidence: string | null
    /** The customer it is about, or null. */
    readonly lead_id: string | null
    /** When it happened, ISO 8601 as the select formats it. */
    readonly created_at: string
}

/** One public.agent_conversations row as the public API reads it. */
export interface ConversationsRow {
    /** The conversation id. */
    readonly id: string
    /** The customer of the conversation, or null. */
    readonly lead_id: string | null
}
