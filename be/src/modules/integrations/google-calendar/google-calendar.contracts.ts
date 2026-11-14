/**
 * The scopes the Calendar operations need, as the reference pages list them (events insert / patch / delete / list:
 * https://developers.google.com/workspace/calendar/api/v3/reference/events/insert lists `calendar`, `calendar.events`,
 * `calendar.app.created`, `calendar.events.owned`; freeBusy: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
 * lists `calendar.readonly`, `calendar`, `calendar.events.freebusy`, `calendar.freebusy`). The narrowest pair that covers every operation
 * is `calendar.events` (events) and `calendar.freebusy` (free / busy). To be declared in `integrations/google/google.contracts.ts` as
 * `CALENDAR_SCOPE` once the lead applies the line (see the report); kept here so this folder compiles on its own.
 */
export const GOOGLE_CALENDAR_SCOPE =
    "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy openid email"

/** The calendar every call defaults to (the reference pages: "Use `primary` for the logged-in user's primary calendar"). */
export const GOOGLE_CALENDAR_PRIMARY = "primary"

/** The attendee notification words of `sendUpdates` NIVO sends (`all`, `none`; the page also lists `externalOnly`). */
export const GOOGLE_SEND_UPDATES = ["all", "none"] as const

/** `events.insert` `id`: "5–1024 characters, lowercase a–v and 0–9" (https://developers.google.com/workspace/calendar/api/v3/reference/events). */
export const GOOGLE_EVENT_ID_MIN = 5
export const GOOGLE_EVENT_ID_MAX = 1024

/** `events.list` `maxResults`: "Defaults to 250 and cannot exceed 2500". */
export const GOOGLE_EVENTS_PAGE_MAX = 2500

/** A moment as Calendar reads it: `dateTime` (RFC3339) with an optional IANA `timeZone`. */
export interface CalendarMoment {
    /** RFC3339 date-time. */
    readonly dateTime: string
    /** IANA time zone name, or null to use the offset of `dateTime`. */
    readonly timeZone: string | null
}

/** One attendee as events.insert takes it (`attendees[].email`). */
export interface CalendarGuest {
    /** The attendee's email address (`attendees[].email`). */
    readonly email: string
}

/** What `events.insert` is asked for. */
export interface GoogleEventInsert {
    /** The calendar the event is created in (`calendarId` path member). */
    readonly calendarId: string
    /** `id`, or null to let Calendar generate one. */
    readonly eventId: string | null
    /** `summary`: the event's title. */
    readonly summary: string
    /** `description`, or null to leave it empty. */
    readonly description: string | null
    /** `location`, or null to leave it empty. */
    readonly location: string | null
    /** `start`: when the event begins. */
    readonly start: CalendarMoment
    /** `end`: when the event ends. */
    readonly end: CalendarMoment
    /** `attendees[]`, or null to send none. */
    readonly attendees: ReadonlyArray<CalendarGuest> | null
    /** `sendUpdates`. */
    readonly sendUpdates: "all" | "none"
}

/** What `events.patch` is asked for: only what changes (omitted members stay; `attendees` replaces the whole array). */
export interface GoogleEventPatch {
    /** The calendar the event lives in (`calendarId` path member). */
    readonly calendarId: string
    /** The event to change (`eventId` path member). */
    readonly eventId: string
    /** New `summary`, or null to leave it. */
    readonly summary: string | null
    /** New `description`, or null to leave it. */
    readonly description: string | null
    /** New `location`, or null to leave it. */
    readonly location: string | null
    /** New `start`, or null to leave it. */
    readonly start: CalendarMoment | null
    /** New `end`, or null to leave it. */
    readonly end: CalendarMoment | null
    /** The whole new `attendees[]` (it replaces the array), or null to leave it. */
    readonly attendees: ReadonlyArray<CalendarGuest> | null
    /** `sendUpdates`: whether Calendar mails the guests about the change. */
    readonly sendUpdates: "all" | "none"
}

/** The members of an Events resource NIVO reads. */
export interface GoogleEvent {
    /** `id`. */
    readonly id: string
    /** `status` (`confirmed`, `tentative`, `cancelled`), or null when absent. */
    readonly status: string | null
    /** `htmlLink`, or null. */
    readonly htmlLink: string | null
    /** `summary`, or null. */
    readonly summary: string | null
    /** `start.dateTime` or `start.date`, or null. */
    readonly start: string | null
    /** `end.dateTime` or `end.date`, or null. */
    readonly end: string | null
}

/** One busy range of a calendar: `start` inclusive, `end` exclusive (RFC3339). */
export interface GoogleBusyRange {
    /** Start of the busy range, inclusive (RFC3339). */
    readonly start: string
    /** End of the busy range, exclusive (RFC3339). */
    readonly end: string
}

/** The answer of a free / busy query for one calendar. */
export interface GoogleFreeBusy {
    /** `calendars.{id}.busy[]`. */
    readonly busy: ReadonlyArray<GoogleBusyRange>
}

/** One page of events (`items[]`, `nextPageToken`). */
export interface GoogleEventPage {
    /** The events of this page (`items[]`). */
    readonly events: ReadonlyArray<GoogleEvent>
    /** `nextPageToken` to ask for the next page, or null on the last page. */
    readonly nextPageToken: string | null
}

/** What `events.list` is asked for. */
export interface GoogleEventListQuery {
    /** The calendar whose events are listed (`calendarId` path member). */
    readonly calendarId: string
    /** `timeMin`: lower bound of the event end time (RFC3339). */
    readonly timeMin: string
    /** `timeMax`: upper bound of the event start time (RFC3339). */
    readonly timeMax: string
    /** `maxResults`. */
    readonly maxResults: number
    /** `pageToken` of the page to read, or null for the first page. */
    readonly pageToken: string | null
}
