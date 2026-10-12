import type { EventListItem } from "@modules/domain/public-api"

/** What listing events takes: the bearer header, an optional start time and the page size as the caller wrote them. */
export interface ListEventsRequest {
    /** The Authorization header as sent. */
    readonly authorization: string | undefined
    /** Only events after this time, ISO 8601. */
    readonly since?: string
    /** The most events to answer; the domain clamps it to 1..500. */
    readonly limit?: string
}

/** What listing events answers: the events oldest first and the cursor for the next call. */
export interface ListEventsResult {
    /** The events after the start of the window, oldest first. */
    readonly events: ReadonlyArray<EventListItem>
    /** The time of the last event, or the start of the window when there was none. */
    readonly nextSince: string
}
