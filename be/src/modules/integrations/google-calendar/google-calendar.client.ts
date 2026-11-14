import { Injectable } from "@nestjs/common"
import { InjectHttpClient, type HttpClient, type HttpRequest, type HttpResponse } from "@modules/platform/http"
import { isRecord } from "@modules/platform/primitives"
import { cutDetail, retryAfterSecondsOf, statusClassOf } from "@modules/integrations/provider-http"
import { GoogleCalendarError, GoogleCalendarErrorCode } from "./errors/google-calendar.error"
import type {
    CalendarMoment,
    GoogleBusyRange,
    GoogleEvent,
    GoogleEventInsert,
    GoogleEventListQuery,
    GoogleEventPage,
    GoogleEventPatch,
    GoogleFreeBusy,
} from "./google-calendar.contracts"
import { InjectGoogleCalendarOptions } from "./google-calendar.decorators"
import type { GoogleCalendarOptions } from "./google-calendar.options"

/**
 * The 403 reasons the errors guide (https://developers.google.com/workspace/calendar/api/guides/errors) says to treat as limits, with
 * backoff: `userRateLimitExceeded`, `rateLimitExceeded` ("handle it the same way as 429") and `quotaExceeded`.
 */
const LIMIT_REASONS: ReadonlySet<string> = new Set(["userRateLimitExceeded", "rateLimitExceeded", "quotaExceeded"])

/** The status a deleted resource answers (the guide: 410 `deleted`, "the resource was already deleted"). */
const GONE = 410

const textOf = (value: unknown): string | null =>
    typeof value === "string" && value.trim() !== "" ? value.trim() : null

/** The first reason and the words of Google's error body. */
export interface GoogleCalendarErrorBody {
    /** The first error's `reason`; "" when the body names none. */
    readonly reason: string
    /** Google's own words; "" when the body has none. */
    readonly message: string
}

/** Google's error body (`{ error: { errors: [{ domain, reason, message }], code, message } }`, the errors guide): its first reason and its words. */
export const googleCalendarErrorOf = (body: unknown): GoogleCalendarErrorBody => {
    const error = isRecord(body) && isRecord(body.error) ? body.error : null
    const first = error !== null && Array.isArray(error.errors) && isRecord(error.errors[0]) ? error.errors[0] : null
    return { reason: textOf(first?.reason) ?? "", message: cutDetail(error?.message) ?? "" }
}

/** The typed failure of an answered status that is no success: by the status and, for a 403, the documented limit reasons. */
const answeredFailure = (answer: HttpResponse): GoogleCalendarError => {
    const status = answer.status
    const { reason, message } = googleCalendarErrorOf(answer.body)
    const params = { status, reason, detail: message }
    if (status === GONE) return new GoogleCalendarError({ code: GoogleCalendarErrorCode.Gone, params })
    const kind = statusClassOf(status)
    if (kind === "auth" && status === 403 && LIMIT_REASONS.has(reason)) {
        return new GoogleCalendarError({
            code: GoogleCalendarErrorCode.RateLimited,
            params: { ...params, retryAfterSeconds: retryAfterSecondsOf(answer.headers) },
        })
    }
    switch (kind) {
        case "auth":
            return new GoogleCalendarError({ code: GoogleCalendarErrorCode.AuthFailed, params })
        case "rate_limited":
            return new GoogleCalendarError({
                code: GoogleCalendarErrorCode.RateLimited,
                params: { ...params, retryAfterSeconds: retryAfterSecondsOf(answer.headers) },
            })
        case "not_found":
            return new GoogleCalendarError({ code: GoogleCalendarErrorCode.NotFound, params })
        case "rejected":
            return new GoogleCalendarError({ code: GoogleCalendarErrorCode.Rejected, params })
        case "ok":
        case "server":
        default:
            return new GoogleCalendarError({ code: GoogleCalendarErrorCode.Failed, params })
    }
}

const malformed = (what: string): never => {
    throw new GoogleCalendarError({ code: GoogleCalendarErrorCode.Malformed, params: { what } })
}

/** A start / end as Calendar's Events resource carries it: `dateTime` (RFC3339) for a timed event, `date` (yyyy-mm-dd) for an all-day one. */
const momentTextOf = (value: unknown): string | null =>
    isRecord(value) ? (textOf(value.dateTime) ?? textOf(value.date)) : null

/** An Events resource (https://developers.google.com/workspace/calendar/api/v3/reference/events): `id`, `status`, `htmlLink`, `summary`, `start`, `end`. */
export const googleEventOf = (body: unknown): GoogleEvent => {
    if (!isRecord(body)) return malformed("event")
    const id = textOf(body.id)
    if (id === null) return malformed("event id")
    return {
        id,
        status: textOf(body.status),
        htmlLink: textOf(body.htmlLink),
        summary: textOf(body.summary),
        start: momentTextOf(body.start),
        end: momentTextOf(body.end),
    }
}

/** The busy ranges of one calendar in a freeBusy answer (`calendars.{id}.busy[]`); `errors[]` on that calendar is a refusal. */
export const googleFreeBusyOf = (body: unknown, calendarId: string): GoogleFreeBusy => {
    if (!isRecord(body) || !isRecord(body.calendars)) return malformed("freeBusy")
    const calendar = body.calendars[calendarId]
    if (!isRecord(calendar)) return malformed("freeBusy calendar")
    if (Array.isArray(calendar.errors) && calendar.errors.length > 0) {
        const first: unknown = calendar.errors[0]
        const reason = isRecord(first) ? (textOf(first.reason) ?? "") : ""
        throw new GoogleCalendarError({
            code: reason === "notFound" ? GoogleCalendarErrorCode.NotFound : GoogleCalendarErrorCode.Rejected,
            params: { status: 200, reason, detail: reason },
        })
    }
    const rows: ReadonlyArray<unknown> = Array.isArray(calendar.busy) ? calendar.busy : []
    const busy = rows.flatMap((row): ReadonlyArray<GoogleBusyRange> => {
        const start = isRecord(row) ? textOf(row.start) : null
        const end = isRecord(row) ? textOf(row.end) : null
        return start === null || end === null ? [] : [{ start, end }]
    })
    return { busy }
}

/** A moment as `start` / `end` of an Events resource: `dateTime` and, when given, `timeZone`. */
const momentBody = (moment: CalendarMoment): Readonly<Record<string, string>> => ({
    dateTime: moment.dateTime,
    ...(moment.timeZone === null ? {} : { timeZone: moment.timeZone }),
})

/** One path segment of a calendar or event id. */
const segment = (value: string): string => encodeURIComponent(value)

/** What `freebusy.query` is asked for. */
export interface GoogleFreeBusyQuery {
    /** The calendar whose busy ranges are read. */
    readonly calendarId: string
    /** Lower bound of the window (RFC3339). */
    readonly timeMin: string
    /** Upper bound of the window (RFC3339). */
    readonly timeMax: string
    /** IANA time zone of the answer, or null to leave it to Calendar. */
    readonly timeZone: string | null
}

/** What `events.delete` is asked for. */
export interface GoogleEventDelete {
    /** The calendar the event lives in. */
    readonly calendarId: string
    /** The event to delete. */
    readonly eventId: string
    /** Whether Calendar mails the guests about the deletion. */
    readonly sendUpdates: "all" | "none"
}

@Injectable()
/**
 * The one place that talks to the Google Calendar API v3 (https://developers.google.com/workspace/calendar/api/v3/reference). The access
 * token is always explicit (one account's, refreshed by the caller) and never logged. Every failure is a `GoogleCalendarError` whose code
 * says WHERE it failed.
 */
export class GoogleCalendarClient {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectGoogleCalendarOptions() private readonly options: GoogleCalendarOptions,
    ) {}

    /**
     * `POST /calendar/v3/freeBusy` with `{ timeMin, timeMax, timeZone?, items: [{ id }] }` (freebusy.query): the busy ranges of one
     * calendar (`start` inclusive, `end` exclusive).
     */
    async freeBusy(
        token: string,
        query: GoogleFreeBusyQuery,
    ): Promise<GoogleFreeBusy> {
        const answer = await this.send(token, {
            method: "POST",
            url: `${this.options.apiBase}/calendar/v3/freeBusy`,
            body: {
                timeMin: query.timeMin,
                timeMax: query.timeMax,
                ...(query.timeZone === null ? {} : { timeZone: query.timeZone }),
                calendarExpansionMax: 1,
                items: [{ id: query.calendarId }],
            },
        })
        return googleFreeBusyOf(answer.body, query.calendarId)
    }

    /** `GET /calendar/v3/calendars/{calendarId}/events` (events.list), single events expanded and ordered by start time. */
    async listEvents(token: string, query: GoogleEventListQuery): Promise<GoogleEventPage> {
        const params = new URLSearchParams({
            timeMin: query.timeMin,
            timeMax: query.timeMax,
            singleEvents: "true",
            orderBy: "startTime",
            maxResults: String(query.maxResults),
        })
        if (query.pageToken !== null) params.set("pageToken", query.pageToken)
        const answer = await this.send(token, {
            method: "GET",
            url: `${this.options.apiBase}/calendar/v3/calendars/${segment(query.calendarId)}/events?${params.toString()}`,
        })
        const body = answer.body
        if (!isRecord(body)) return malformed("events")
        const items: ReadonlyArray<unknown> = Array.isArray(body.items) ? body.items : []
        return { events: items.map((item) => googleEventOf(item)), nextPageToken: textOf(body.nextPageToken) }
    }

    /** `POST /calendar/v3/calendars/{calendarId}/events?sendUpdates=` (events.insert): the created event. */
    async insertEvent(token: string, request: GoogleEventInsert): Promise<GoogleEvent> {
        const answer = await this.send(token, {
            method: "POST",
            url: `${this.options.apiBase}/calendar/v3/calendars/${segment(request.calendarId)}/events?sendUpdates=${request.sendUpdates}`,
            body: {
                ...(request.eventId === null ? {} : { id: request.eventId }),
                summary: request.summary,
                ...(request.description === null ? {} : { description: request.description }),
                ...(request.location === null ? {} : { location: request.location }),
                start: momentBody(request.start),
                end: momentBody(request.end),
                ...(request.attendees === null ? {} : { attendees: request.attendees.map((guest) => ({ email: guest.email })) }),
            },
        })
        return googleEventOf(answer.body)
    }

    /**
     * `PATCH /calendar/v3/calendars/{calendarId}/events/{eventId}?sendUpdates=` (events.patch): "Fields you specify replace existing
     * values. Fields you omit remain unchanged." so only what changes is sent; `attendees`, an array, replaces the whole list.
     */
    async patchEvent(token: string, request: GoogleEventPatch): Promise<GoogleEvent> {
        const answer = await this.send(token, {
            method: "PATCH",
            url: `${this.options.apiBase}/calendar/v3/calendars/${segment(request.calendarId)}/events/${segment(request.eventId)}?sendUpdates=${request.sendUpdates}`,
            body: {
                ...(request.summary === null ? {} : { summary: request.summary }),
                ...(request.description === null ? {} : { description: request.description }),
                ...(request.location === null ? {} : { location: request.location }),
                ...(request.start === null ? {} : { start: momentBody(request.start) }),
                ...(request.end === null ? {} : { end: momentBody(request.end) }),
                ...(request.attendees === null ? {} : { attendees: request.attendees.map((guest) => ({ email: guest.email })) }),
            },
        })
        return googleEventOf(answer.body)
    }

    /**
     * `DELETE /calendar/v3/calendars/{calendarId}/events/{eventId}?sendUpdates=` (events.delete): an empty body on success. A 410 `deleted`
     * means it was already gone ("No action needed"): answered `false`, a deletion that did happen `true`.
     */
    async deleteEvent(
        token: string,
        request: GoogleEventDelete,
    ): Promise<boolean> {
        try {
            await this.send(token, {
                method: "DELETE",
                url: `${this.options.apiBase}/calendar/v3/calendars/${segment(request.calendarId)}/events/${segment(request.eventId)}?sendUpdates=${request.sendUpdates}`,
            })
            return true
        } catch (cause) {
            if (cause instanceof GoogleCalendarError && cause.code === GoogleCalendarErrorCode.Gone) return false
            throw cause
        }
    }

    /** Sends one request with the bearer token: a transport failure is `Unreachable` (it may have left), an answered failure is typed. */
    private async send(token: string, request: Omit<HttpRequest, "headers" | "timeoutMs">): Promise<HttpResponse> {
        const answer = await this.http.request({ ...request, headers: { authorization: `Bearer ${token}` }, timeoutMs: this.options.timeoutMs }).catch(
            (cause: unknown) => {
                throw new GoogleCalendarError({ code: GoogleCalendarErrorCode.Unreachable, cause })
            },
        )
        if (statusClassOf(answer.status) !== "ok") throw answeredFailure(answer)
        return answer
    }
}
