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

/** A received input with feed timestamps and repeat-delivery counts. */
export interface InboundEventFeedRow extends InboundEventRow {
    /** How many duplicate deliveries have been blocked. */
    readonly duplicate_count: number
    /** When this event was first received, as ISO 8601 text. */
    readonly created_at: string
}
