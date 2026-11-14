import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HTTP_CLIENT, HttpError, HttpErrorCode } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { GoogleCalendarErrorCode } from "./errors/google-calendar.error"
import { GoogleCalendarClient, googleCalendarErrorOf, googleEventOf, googleFreeBusyOf } from "./google-calendar.client"
import { GOOGLE_CALENDAR_OPTIONS } from "./google-calendar.decorators"
import { GOOGLE_CALENDAR_OPERATIONS } from "./google-calendar.operations"
import type { GoogleCalendarOptions } from "./google-calendar.options"
import { causeFactsOf } from "@tests/fixtures/builders/cause-facts.builder"

const BASE = "https://www.googleapis.com"
const options: GoogleCalendarOptions = { apiBase: BASE, timeoutMs: 4000 }
const TOKEN = ["test", "token"].join("-")
const AUTH = { authorization: `Bearer ${TOKEN}` }

/**
 * The error body of the errors guide (https://developers.google.com/workspace/calendar/api/guides/errors, "JSON error body": its example
 * verbatim).
 */
const TIME_RANGE_EMPTY = {
    error: {
        errors: [
            { domain: "calendar", reason: "timeRangeEmpty", message: "The specified time range is empty.", locationType: "parameter", location: "timeMax" },
        ],
        code: 400,
        message: "The specified time range is empty.",
    },
}

/** A 403 limit body: the guide's table lists 403 `rateLimitExceeded` (the body shape is the guide's example, the reason is the table's). */
const LIMIT = { error: { errors: [{ domain: "usageLimits", reason: "rateLimitExceeded" }], code: 403, message: "Rate Limit Exceeded" } }

/**
 * A freeBusy answer shaped by the members the page lists (https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query:
 * `kind`, `timeMin`, `timeMax`, `calendars.{key}.busy[]` with `start` and `end`).
 */
const FREE_BUSY = {
    kind: "calendar#freeBusy",
    timeMin: "2026-01-06T09:00:00Z",
    timeMax: "2026-01-06T17:00:00Z",
    calendars: { primary: { busy: [{ start: "2026-01-06T10:00:00Z", end: "2026-01-06T11:00:00Z" }] } },
}

/** An Events resource shaped by the members the page lists (https://developers.google.com/workspace/calendar/api/v3/reference/events). */
const EVENT = {
    id: "evt123abc",
    status: "confirmed",
    htmlLink: "https://www.google.com/calendar/event?eid=abc",
    summary: "Consultation",
    start: { dateTime: "2026-01-06T10:00:00+07:00", timeZone: "Asia/Ho_Chi_Minh" },
    end: { dateTime: "2026-01-06T10:30:00+07:00", timeZone: "Asia/Ho_Chi_Minh" },
}

const build = async () => {
    const http = mock<HttpClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [GoogleCalendarClient, { provide: HTTP_CLIENT, useValue: http }, { provide: GOOGLE_CALENDAR_OPTIONS, useValue: options }],
    }).compile()
    return { client: moduleRef.get(GoogleCalendarClient), http }
}

/** The `code` of the error a call throws, or undefined when it throws nothing. */
const codeThrownBy = (work: () => unknown): unknown => {
    try {
        work()
    } catch (cause) {
        return causeFactsOf(cause).code
    }
    return undefined
}

describe("GoogleCalendarClient > freeBusy (freebusy.query)", () => {
    it("posts the interval and the one calendar with the bearer token, and reads its busy ranges", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: FREE_BUSY })

        const result = await client.freeBusy(TOKEN, {
            calendarId: "primary",
            timeMin: "2026-01-06T09:00:00Z",
            timeMax: "2026-01-06T17:00:00Z",
            timeZone: "Asia/Ho_Chi_Minh",
        })

        expect(result).toEqual({ busy: [{ start: "2026-01-06T10:00:00Z", end: "2026-01-06T11:00:00Z" }] })
        expect(http.request).toHaveBeenCalledWith({
            method: "POST",
            url: `${BASE}/calendar/v3/freeBusy`,
            headers: AUTH,
            body: {
                timeMin: "2026-01-06T09:00:00Z",
                timeMax: "2026-01-06T17:00:00Z",
                timeZone: "Asia/Ho_Chi_Minh",
                calendarExpansionMax: 1,
                items: [{ id: "primary" }],
            },
            timeoutMs: 4000,
        })
    })

    it("refuses a calendar the answer reports an error on: notFound is not-found, any other reason is a refusal", () => {
        const notFound = { calendars: { x: { errors: [{ domain: "global", reason: "notFound" }], busy: [] } } }
        const other = { calendars: { x: { errors: [{ domain: "global", reason: "groupTooBig" }] } } }
        expect(codeThrownBy(() => googleFreeBusyOf(notFound, "x"))).toBe(GoogleCalendarErrorCode.NotFound)
        expect(codeThrownBy(() => googleFreeBusyOf(other, "x"))).toBe(GoogleCalendarErrorCode.Rejected)
    })

    it("reads an answer without the calendar as malformed, and no busy member as free", () => {
        expect(codeThrownBy(() => googleFreeBusyOf({ calendars: {} }, "primary"))).toBe(GoogleCalendarErrorCode.Malformed)
        expect(googleFreeBusyOf({ calendars: { primary: {} } }, "primary")).toEqual({ busy: [] })
    })
})

describe("GoogleCalendarClient > events", () => {
    it("lists single events in a window, ordered by start, with a page token", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: { kind: "calendar#events", items: [EVENT], nextPageToken: "next-1" } })

        const page = await client.listEvents(TOKEN, {
            calendarId: "a@example.com",
            timeMin: "2026-01-06T00:00:00+07:00",
            timeMax: "2026-01-07T00:00:00+07:00",
            maxResults: 50,
            pageToken: "p1",
        })

        expect(page.nextPageToken).toBe("next-1")
        expect(page.events).toEqual([
            {
                id: "evt123abc",
                status: "confirmed",
                htmlLink: "https://www.google.com/calendar/event?eid=abc",
                summary: "Consultation",
                start: "2026-01-06T10:00:00+07:00",
                end: "2026-01-06T10:30:00+07:00",
            },
        ])
        const sent = http.request.mock.calls[0]?.[0]
        expect(sent?.method).toBe("GET")
        const url = new URL(sent?.url ?? "")
        expect(url.pathname).toBe("/calendar/v3/calendars/a%40example.com/events")
        expect(Object.fromEntries(url.searchParams)).toEqual({
            timeMin: "2026-01-06T00:00:00+07:00",
            timeMax: "2026-01-07T00:00:00+07:00",
            singleEvents: "true",
            orderBy: "startTime",
            maxResults: "50",
            pageToken: "p1",
        })
    })

    it("inserts an event with only the members it was given, notifying as asked", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: EVENT })

        const event = await client.insertEvent(TOKEN, {
            calendarId: "primary",
            eventId: "abcde12345",
            summary: "Consultation",
            description: null,
            location: "Shop",
            start: { dateTime: "2026-01-06T10:00:00+07:00", timeZone: "Asia/Ho_Chi_Minh" },
            end: { dateTime: "2026-01-06T10:30:00+07:00", timeZone: null },
            attendees: [{ email: "a@example.com" }],
            sendUpdates: "all",
        })

        expect(event.id).toBe("evt123abc")
        expect(http.request).toHaveBeenCalledWith({
            method: "POST",
            url: `${BASE}/calendar/v3/calendars/primary/events?sendUpdates=all`,
            headers: AUTH,
            body: {
                id: "abcde12345",
                summary: "Consultation",
                location: "Shop",
                start: { dateTime: "2026-01-06T10:00:00+07:00", timeZone: "Asia/Ho_Chi_Minh" },
                end: { dateTime: "2026-01-06T10:30:00+07:00" },
                attendees: [{ email: "a@example.com" }],
            },
            timeoutMs: 4000,
        })
    })

    it("patches only what changes (omitted members are left out so they stay)", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: EVENT })

        await client.patchEvent(TOKEN, {
            calendarId: "primary",
            eventId: "evt123abc",
            summary: "Moved",
            description: null,
            location: null,
            start: null,
            end: null,
            attendees: null,
            sendUpdates: "none",
        })

        expect(http.request).toHaveBeenCalledWith({
            method: "PATCH",
            url: `${BASE}/calendar/v3/calendars/primary/events/evt123abc?sendUpdates=none`,
            headers: AUTH,
            body: { summary: "Moved" },
            timeoutMs: 4000,
        })
    })

    it("deletes an event with no body; a 410 deleted is an event already gone", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValueOnce({ status: 204, body: undefined })
        await expect(client.deleteEvent(TOKEN, { calendarId: "primary", eventId: "evt123abc", sendUpdates: "all" })).resolves.toBe(true)
        expect(http.request).toHaveBeenCalledWith({
            method: "DELETE",
            url: `${BASE}/calendar/v3/calendars/primary/events/evt123abc?sendUpdates=all`,
            headers: AUTH,
            timeoutMs: 4000,
        })

        http.request.mockResolvedValueOnce({ status: 410, body: { error: { errors: [{ domain: "global", reason: "deleted" }], code: 410, message: "Resource has been deleted" } } })
        await expect(client.deleteEvent(TOKEN, { calendarId: "primary", eventId: "evt123abc", sendUpdates: "none" })).resolves.toBe(false)
    })

    it("reads an Events resource without an id as malformed and an all-day start by its date", () => {
        expect(codeThrownBy(() => googleEventOf({ summary: "x" }))).toBe(GoogleCalendarErrorCode.Malformed)
        expect(googleEventOf({ id: "e1", start: { date: "2026-01-06" }, end: { date: "2026-01-07" } }).start).toBe("2026-01-06")
    })
})

describe("GoogleCalendarClient > failures by where the call failed", () => {
    const failsWith = async (status: number, body: unknown, headers?: Record<string, string>) => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status, body, ...(headers === undefined ? {} : { headers }) })
        return client.insertEvent(TOKEN, {
            calendarId: "primary",
            eventId: null,
            summary: "x",
            description: null,
            location: null,
            start: { dateTime: "2026-01-06T10:00:00Z", timeZone: null },
            end: { dateTime: "2026-01-06T11:00:00Z", timeZone: null },
            attendees: null,
            sendUpdates: "none",
        })
    }

    it("reads the guide's error body", () => {
        expect(googleCalendarErrorOf(TIME_RANGE_EMPTY)).toEqual({ reason: "timeRangeEmpty", message: "The specified time range is empty." })
        expect(googleCalendarErrorOf("not json")).toEqual({ reason: "", message: "" })
    })

    it("400 is a rejection carrying the reason; 409 duplicate is a rejection too", async () => {
        await expect(failsWith(400, TIME_RANGE_EMPTY)).rejects.toMatchObject({
            code: GoogleCalendarErrorCode.Rejected,
            params: { status: 400, reason: "timeRangeEmpty" },
        })
        await expect(failsWith(409, { error: { errors: [{ domain: "global", reason: "duplicate" }], code: 409, message: "The requested identifier already exists." } })).rejects.toMatchObject({
            code: GoogleCalendarErrorCode.Rejected,
            params: { status: 409, reason: "duplicate" },
        })
    })

    it("401 is an auth failure; a 403 with no limit reason is one too", async () => {
        await expect(failsWith(401, { error: { errors: [{ domain: "global", reason: "authError" }], code: 401, message: "Invalid Credentials" } })).rejects.toMatchObject({
            code: GoogleCalendarErrorCode.AuthFailed,
            params: { status: 401 },
        })
        await expect(failsWith(403, { error: { errors: [{ domain: "calendar", reason: "forbiddenForNonOrganizer" }], code: 403, message: "x" } })).rejects.toMatchObject({
            code: GoogleCalendarErrorCode.AuthFailed,
        })
    })

    it("429 and a 403 limit reason are rate limits, with the seconds asked", async () => {
        await expect(failsWith(429, { error: { errors: [{ domain: "usageLimits", reason: "rateLimitExceeded" }], code: 429, message: "x" } }, { "retry-after": "7" })).rejects.toMatchObject({
            code: GoogleCalendarErrorCode.RateLimited,
            params: { retryAfterSeconds: 7 },
        })
        await expect(failsWith(403, LIMIT)).rejects.toMatchObject({ code: GoogleCalendarErrorCode.RateLimited })
    })

    it("404 is not found, 5xx may have acted, a transport failure is unreachable", async () => {
        await expect(failsWith(404, { error: { errors: [{ domain: "global", reason: "notFound" }], code: 404, message: "Not Found" } })).rejects.toMatchObject({
            code: GoogleCalendarErrorCode.NotFound,
        })
        await expect(failsWith(500, { error: { errors: [{ domain: "global", reason: "backendError" }], code: 500, message: "x" } })).rejects.toMatchObject({
            code: GoogleCalendarErrorCode.Failed,
        })
        const { client, http } = await build()
        http.request.mockRejectedValue(new HttpError({ code: HttpErrorCode.Timeout }))
        await expect(client.deleteEvent(TOKEN, { calendarId: "primary", eventId: "e1", sendUpdates: "none" })).rejects.toMatchObject({
            code: GoogleCalendarErrorCode.Unreachable,
        })
    })
})

describe("GOOGLE_CALENDAR_OPERATIONS", () => {
    it("names every operation under nivo.api.google.calendar with its method and a documentation URL", () => {
        const rows = Object.values(GOOGLE_CALENDAR_OPERATIONS)
        expect(rows).toHaveLength(5)
        for (const row of rows) {
            expect(row.api.startsWith("nivo.api.google.calendar.")).toBe(true)
            expect(row.docs.startsWith("https://developers.google.com/workspace/calendar/api/v3/reference/")).toBe(true)
            expect(row.status).toBe("built")
        }
    })
})
