import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import type {
    CalendarBusy,
    CalendarBusyQuery,
    CalendarEvent,
    CalendarEventChange,
    CalendarEventRequest,
    CalendarInstant,
    CalendarPort,
} from "@modules/domain/provider-registry"
import {
    GOOGLE_CALENDAR_PRIMARY,
    InjectGoogleCalendar,
    type CalendarMoment,
    type GoogleCalendarClient,
    type GoogleEvent,
} from "@modules/integrations/google-calendar"
import { GoogleCalendarCredentialService } from "./google-calendar-credential.service"
import { GOOGLE_CALENDAR_PROVIDER, googleCalendarFailureOf } from "./google-calendar-failure.policy"
import { DomainError } from "@modules/platform/errors"

const momentOf = (instant: CalendarInstant): CalendarMoment => ({ dateTime: instant.dateTime, timeZone: instant.timeZone })

const guestsOf = (guests: ReadonlyArray<string> | null): ReadonlyArray<{ readonly email: string }> | null =>
    guests === null ? null : guests.map((email) => ({ email }))

const eventOf = (calendarId: string, event: GoogleEvent): CalendarEvent => ({
    calendarId,
    eventId: event.id,
    status: event.status,
    link: event.htmlLink,
    summary: event.summary,
    start: event.start,
    end: event.end,
})

const updatesOf = (notify: boolean): "all" | "none" => (notify ? "all" : "none")

/** The event a cancel names, and whether the guests are told. */
interface CancelEventRequest {
    /** The calendar, or null for the primary one. */
    readonly calendarId: string | null
    /** The event. */
    readonly eventId: string
    /** Whether the guests are told. */
    readonly notifyGuests: boolean
}

@Injectable()
/**
 * Google Calendar (API v3) as the adapter of the generic calendar purpose (`CalendarPort`), on the Google account whose owner consented to
 * the Calendar scopes. The calendar is the request's, else the account's primary one. A free / busy window, an event made, changed or
 * cancelled: each one Calendar call; the slot arithmetic is the tool's, not this adapter's.
 */
export class GoogleCalendarService implements CalendarPort {
    /** The provider key. */
    readonly provider: string = GOOGLE_CALENDAR_PROVIDER

    constructor(
        @InjectGoogleCalendar() private readonly client: GoogleCalendarClient,
        private readonly credentials: GoogleCalendarCredentialService,
    ) {}

    /** The busy ranges of one calendar (`POST freeBusy`). */
    async busy(connection: ConnectionRecord, query: CalendarBusyQuery): Promise<CalendarBusy> {
        const calendarId = query.calendarId ?? GOOGLE_CALENDAR_PRIMARY
        const answer = await this.guarded(() =>
            this.credentials.withToken(connection, (token) =>
                this.client.freeBusy(token, {
                    calendarId,
                    timeMin: query.windowStart,
                    timeMax: query.windowEnd,
                    timeZone: query.timeZone,
                }),
            ),
        )
        return { calendarId, busy: answer.busy.map((range) => ({ start: range.start, end: range.end })) }
    }

    /** Makes one event (`POST events`). */
    async createEvent(connection: ConnectionRecord, request: CalendarEventRequest): Promise<CalendarEvent> {
        const calendarId = request.calendarId ?? GOOGLE_CALENDAR_PRIMARY
        const event = await this.guarded(() =>
            this.credentials.withToken(connection, (token) =>
                this.client.insertEvent(token, {
                    calendarId,
                    eventId: request.eventId,
                    summary: request.summary,
                    description: request.description,
                    location: request.location,
                    start: momentOf(request.start),
                    end: momentOf(request.end),
                    attendees: guestsOf(request.guests),
                    sendUpdates: updatesOf(request.notifyGuests),
                }),
            ),
        )
        return eventOf(calendarId, event)
    }

    /** Changes one event (`PATCH events/{id}`): only what is set. */
    async updateEvent(connection: ConnectionRecord, change: CalendarEventChange): Promise<CalendarEvent> {
        const calendarId = change.calendarId ?? GOOGLE_CALENDAR_PRIMARY
        const event = await this.guarded(() =>
            this.credentials.withToken(connection, (token) =>
                this.client.patchEvent(token, {
                    calendarId,
                    eventId: change.eventId,
                    summary: change.summary,
                    description: change.description,
                    location: change.location,
                    start: change.start === null ? null : momentOf(change.start),
                    end: change.end === null ? null : momentOf(change.end),
                    attendees: guestsOf(change.guests),
                    sendUpdates: updatesOf(change.notifyGuests),
                }),
            ),
        )
        return eventOf(calendarId, event)
    }

    /** Removes one event (`DELETE events/{id}`); `cancelled` is false when Calendar says it was already deleted (410). */
    async cancelEvent(
        connection: ConnectionRecord,
        request: CancelEventRequest,
    ): Promise<{ readonly calendarId: string; readonly eventId: string; readonly cancelled: boolean }> {
        const calendarId = request.calendarId ?? GOOGLE_CALENDAR_PRIMARY
        const cancelled = await this.guarded(() =>
            this.credentials.withToken(connection, (token) =>
                this.client.deleteEvent(token, { calendarId, eventId: request.eventId, sendUpdates: updatesOf(request.notifyGuests) }),
            ),
        )
        return { calendarId, eventId: request.eventId, cancelled }
    }

    private async guarded<T>(call: () => Promise<T>): Promise<T> {
        try {
            return await call()
        } catch (cause) {
            const failure = googleCalendarFailureOf(cause)
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }
}
