import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import type { SandboxCatalogue } from "@modules/domain/provider-sandbox"

/** One event of the fixed week the sandbox calendar holds. */
export interface GoogleCalendarSandboxEvent {
    /** The event id. */
    readonly eventId: string
    /** The title. */
    readonly summary: string
    /** Start, RFC 3339 with an offset. */
    readonly start: string
    /** End, RFC 3339 with an offset. */
    readonly end: string
}

/** The calendar id every account's own calendar answers to when a request names none (Google's own word). */
export const GCAL_SANDBOX_PRIMARY = "primary"

/** An empty calendar: the whole week is free (GCAL-2). */
export const GCAL_SANDBOX_EMPTY_CALENDAR = "calendar-trong"

/** The calendar whose credential is expired: every operation on it is refused `auth_refused` (GCAL-7). */
export const GCAL_SANDBOX_EXPIRED_CALENDAR = "calendar-het-han"

/** The calendar the account does not hold: every operation on it is refused `not_found` (GCAL-8). */
export const GCAL_SANDBOX_MISSING_CALENDAR = "calendar-khong-co"

/** The address an event's link starts with; the event id follows. */
export const GCAL_SANDBOX_LINK_BASE = "https://calendar.sandbox.test/event?eid="

/**
 * The events of the account's primary calendar in the fixed week Monday 16 to Sunday 22 November 2026 (Vietnam time, +07:00): what a
 * free / busy read answers and what a change or a cancel can name. Everything outside them is free.
 */
export const GCAL_SANDBOX_EVENTS: ReadonlyArray<GoogleCalendarSandboxEvent> = [
    { eventId: "sbx-evt-giao-ban", summary: "Họp giao ban", start: "2026-11-16T09:00:00+07:00", end: "2026-11-16T10:00:00+07:00" },
    { eventId: "sbx-evt-khach-hang", summary: "Gặp khách hàng", start: "2026-11-17T14:00:00+07:00", end: "2026-11-17T15:30:00+07:00" },
    { eventId: "sbx-evt-nhap-hang", summary: "Nhận hàng nhập", start: "2026-11-18T10:00:00+07:00", end: "2026-11-18T11:00:00+07:00" },
    { eventId: "sbx-evt-dao-tao", summary: "Đào tạo nhân viên", start: "2026-11-19T09:00:00+07:00", end: "2026-11-19T12:00:00+07:00" },
    { eventId: "sbx-evt-kiem-ke", summary: "Kiểm kê cuối tuần", start: "2026-11-20T15:00:00+07:00", end: "2026-11-20T16:00:00+07:00" },
]

/** The duplicate refusal's words: Calendar answers 409 to an event id that already exists. */
export const GCAL_SANDBOX_DUPLICATE_DETAIL = "The requested identifier already exists."

/** The hardcoded catalogue of the Google Calendar sandbox (ruling R60): ids `GCAL-<n>`, identical on every machine. */
export const GCAL_SANDBOX_CATALOGUE: SandboxCatalogue = {
    provider: PROVIDER.google,
    cases: [
        { id: "GCAL-1", label: "The primary calendar of the fixed week 16-22 Nov 2026 is busy at five fixed events; everything else in the window is free", operation: "busy" },
        { id: "GCAL-2", label: "The calendar calendar-trong holds no event: the whole window is free", operation: "busy" },
        { id: "GCAL-3", label: "An event made is kept in state: confirmed, with a link, and busy in every later free / busy read until cancelled", operation: "createEvent" },
        { id: "GCAL-4", label: "An event made under an id that already exists (the caller's own id, or a fixed one) is refused rejected: duplicate (the live 409; overlapping times are not refused, as Calendar does not)", operation: "createEvent" },
        { id: "GCAL-5", label: "An event changed answers its new title and times; an event the calendar does not hold (or one cancelled) answers not found", operation: "updateEvent" },
        { id: "GCAL-6", label: "An event cancelled answers cancelled true; cancelled again, cancelled false (already gone, the live 410); an unknown one answers not found", operation: "cancelEvent" },
        { id: "GCAL-7", label: "Every operation on the calendar calendar-het-han is refused: the credential expired (auth refused)", operation: "busy" },
        { id: "GCAL-8", label: "Every operation on the calendar calendar-khong-co is refused not found", operation: "busy" },
    ],
}
