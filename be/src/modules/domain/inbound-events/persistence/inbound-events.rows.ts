/** The identity of an inbound event. */
export interface EventIdRow {
    /** The event id. */
    readonly id: string
}

/** public.inbound_events as the engine reads it. */
export interface InboundEventRow {
    /** The event id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The channel key. */
    readonly channel: string
    /** The kind of input. */
    readonly kind: string
    /** `live` or `simulated`. */
    readonly origin: string
    /** The sender's name. */
    readonly sender_name: string | null
    /** The sender's phone or email. */
    readonly sender_contact: string | null
    /** The text. */
    readonly body: string
    /** The money in it, VND. */
    readonly amount_vnd: number | null
    /** The external reference. */
    readonly external_ref: string | null
    /** The channel's own event id. */
    readonly event_id: string | null
    /** The customer it belongs to. */
    readonly lead_id: string | null
    /** Where it stands. */
    readonly status: string
}
