import type { ConnectionRecord } from "@modules/domain/connections"

/**
 * THE GENERIC CALENDAR PURPOSE: a calendar that holds events and answers when it is busy (Google Calendar today, Microsoft later). The
 * tools `nivo.tool.calendar.*` are GENERIC because all three tests hold: the same intent (the shop's calendar), the same core contract
 * (a window, an event) and substitutable (another calendar given the same call yields the same business result). The words are neutral
 * (`calendarId`, `guests`), never a provider's. A failure is thrown with what it proves (`withProof`); a refusal the provider answered
 * (`providerRefusal` (a `ProviderRegistryError`)) proves no effect.
 */

/** One moment as an RFC 3339 date-time with an offset, and the IANA zone it is told in, or null to use the offset. */
export interface CalendarInstant {
    /** RFC 3339 date-time. */
    readonly dateTime: string
    /** IANA time zone name, or null. */
    readonly timeZone: string | null
}

/** What the busy ranges of one calendar are asked for. */
export interface CalendarBusyQuery {
    /** The calendar, or null for the account's own (its primary calendar). */
    readonly calendarId: string | null
    /** The window's start (RFC 3339 with an offset). */
    readonly windowStart: string
    /** The window's end (RFC 3339 with an offset). */
    readonly windowEnd: string
    /** The IANA zone the provider is asked to answer in, or null. */
    readonly timeZone: string | null
}

/** One busy range: `start` inclusive, `end` exclusive (RFC 3339). */
export interface CalendarBusyRange {
    /** Where the range begins. */
    readonly start: string
    /** Where the range ends. */
    readonly end: string
}

/** The busy ranges of one calendar in a window. */
export interface CalendarBusy {
    /** The calendar the ranges belong to (as the provider names it). */
    readonly calendarId: string
    /** Its busy ranges, in the provider's order (not necessarily sorted or disjoint: the tool's arithmetic merges them). */
    readonly busy: ReadonlyArray<CalendarBusyRange>
}

/** What a new event is made from. */
export interface CalendarEventRequest {
    /** The calendar, or null for the account's own. */
    readonly calendarId: string | null
    /** The caller's own id for the event (the provider's documented alphabet and length), or null to let the provider generate one. */
    readonly eventId: string | null
    /** The title. */
    readonly summary: string
    /** Free text, or null. */
    readonly description: string | null
    /** Where, free text, or null. */
    readonly location: string | null
    /** When it starts. */
    readonly start: CalendarInstant
    /** When it ends. */
    readonly end: CalendarInstant
    /** The guests' mail addresses, or null for none. */
    readonly guests: ReadonlyArray<string> | null
    /** Whether the provider tells the guests. */
    readonly notifyGuests: boolean
}

/** What an event changes: only what is set is changed; `guests` replaces the whole list. */
export interface CalendarEventChange {
    /** The calendar, or null for the account's own. */
    readonly calendarId: string | null
    /** The event. */
    readonly eventId: string
    /** The new title, or null to leave it as it is. */
    readonly summary: string | null
    /** The new description, or null to leave it as it is. */
    readonly description: string | null
    /** The new place, or null to leave it as it is. */
    readonly location: string | null
    /** The new start, or null to leave it as it is. */
    readonly start: CalendarInstant | null
    /** The new end, or null to leave it as it is. */
    readonly end: CalendarInstant | null
    /** The new guest list, which replaces the whole list, or null to leave it as it is. */
    readonly guests: ReadonlyArray<string> | null
    /** Whether the provider tells the guests. */
    readonly notifyGuests: boolean
}

/** An event as the provider answers it. */
export interface CalendarEvent {
    /** The calendar it is on. */
    readonly calendarId: string
    /** The provider's id of the event. */
    readonly eventId: string
    /** The provider's status word (`confirmed`, `tentative`, `cancelled` for Google), or null. */
    readonly status: string | null
    /** A link to open it, or null. */
    readonly link: string | null
    /** The title, or null. */
    readonly summary: string | null
    /** Its start as the provider tells it (date-time, or a date for an all-day event), or null. */
    readonly start: string | null
    /** Its end as the provider tells it, or null. */
    readonly end: string | null
}

/** A provider that keeps a calendar. */
export interface CalendarPort {
    /** The provider key. */
    readonly provider: string
    /** The busy ranges of one calendar in a window. */
    busy(connection: ConnectionRecord, query: CalendarBusyQuery): Promise<CalendarBusy>
    /** Makes one event. */
    createEvent(connection: ConnectionRecord, request: CalendarEventRequest): Promise<CalendarEvent>
    /** Changes one event. */
    updateEvent(connection: ConnectionRecord, change: CalendarEventChange): Promise<CalendarEvent>
    /** Cancels (removes) one event; `cancelled` is false when it was already gone. */
    cancelEvent(
        connection: ConnectionRecord,
        request: { readonly calendarId: string | null; readonly eventId: string; readonly notifyGuests: boolean },
    ): Promise<{ readonly calendarId: string; readonly eventId: string; readonly cancelled: boolean }>
}
