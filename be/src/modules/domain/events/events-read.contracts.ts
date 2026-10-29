/** The first time a customer reached one of a set of event kinds. */
export interface LeadFirstEvent {
    /** The customer. */
    readonly leadId: string
    /** When the customer first reached one of the kinds. */
    readonly at: Date
}

/** An evidence line as the public API lists it. */
export interface ApiEvent {
    /** The event id. */
    readonly id: string
    /** The event kind, e.g. api.lead. */
    readonly kind: string
    /** Who did it. */
    readonly actor: string
    /** One line telling what happened. */
    readonly summary: string
    /** The evidence clipped to 500 characters, or null. */
    readonly evidence: string | null
    /** The customer it is about, or null. */
    readonly leadId: string | null
    /** When it happened, ISO 8601 in UTC with milliseconds. */
    readonly createdAt: string
}
