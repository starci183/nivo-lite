/** One evidence line of the public API. */
export class EventResponse {
    /** The event id. */
    id!: string
    /** The event kind, e.g. api.lead. */
    kind!: string
    /** Who did it. */
    actor!: string
    /** One line telling what happened. */
    summary!: string
    /** The evidence, clipped to 500 characters, or null. */
    evidence!: string | null
    /** The customer it is about, or null. */
    lead_id!: string | null
    /** When it happened, ISO 8601. */
    created_at!: string
}

/** The events and the cursor of GET /api/v1/events. */
export class EventsDataResponse {
    /** The events after `since`, oldest first. */
    events!: Array<EventResponse>
    /** Pass this as `since` next time. */
    next_since!: string
}

/** The HTTP response of GET /api/v1/events: the public API wraps its payload in `data`. */
export class ListEventsResponse {
    /** The events and the cursor. */
    data!: EventsDataResponse
}
