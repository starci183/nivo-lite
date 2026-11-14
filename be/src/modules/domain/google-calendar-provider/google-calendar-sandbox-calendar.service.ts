import { Injectable } from "@nestjs/common"
import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import type { ConnectionRecord } from "@modules/domain/connections"
import {
    providerRefusal,
    withProof,
    type CalendarBusy,
    type CalendarBusyQuery,
    type CalendarEvent,
    type CalendarEventChange,
    type CalendarEventRequest,
    type CalendarPort,
} from "@modules/domain/provider-registry"
import { ProviderSandboxService, type SandboxState } from "@modules/domain/provider-sandbox"
import {
    GCAL_SANDBOX_DUPLICATE_DETAIL,
    GCAL_SANDBOX_EVENTS,
    GCAL_SANDBOX_EXPIRED_CALENDAR,
    GCAL_SANDBOX_LINK_BASE,
    GCAL_SANDBOX_MISSING_CALENDAR,
    GCAL_SANDBOX_PRIMARY,
} from "./google-calendar-sandbox.catalogue"

/** The sandbox operation words, the port's own method names. */
const BUSY_OPERATION = "busy"
const CREATE_OPERATION = "createEvent"
const UPDATE_OPERATION = "updateEvent"
const CANCEL_OPERATION = "cancelEvent"

/** State name: an event the account changed, made or cancelled, by `<calendar id>|<event id>` (what the catalogue's own value yields to). */
const EVENT = "event"

/** State name: the ids of the events the account made, by calendar id (what a free / busy read adds to the fixed week). */
const MADE = "made"

/** An event as the account's state keeps it. */
interface KeptEvent {
    readonly summary: string | null
    readonly start: string | null
    readonly end: string | null
    readonly cancelled: boolean
}

type CancelAnswer = { readonly calendarId: string; readonly eventId: string; readonly cancelled: boolean }

const refused = (reason: "rejected" | "not_found" | "auth_refused", detail: string): Error =>
    withProof(providerRefusal(PROVIDER.google, reason, detail), "not_sent")

const keyOf = (calendarId: string, eventId: string): string => `${calendarId}|${eventId}`

/** The refusal a calendar the catalogue names gets, on every operation: an expired credential, or a calendar the account does not hold. */
const assertCalendar = (calendarId: string): void => {
    if (calendarId === GCAL_SANDBOX_EXPIRED_CALENDAR) throw refused("auth_refused", "Invalid Credentials")
    if (calendarId === GCAL_SANDBOX_MISSING_CALENDAR) throw refused("not_found", "Not Found")
}

/** The event as it stands: the state's own value, else the fixed week's (primary calendar only), else null. */
const eventAt = async (state: SandboxState, calendarId: string, eventId: string): Promise<KeptEvent | null> => {
    const kept = await state.read(EVENT, keyOf(calendarId, eventId))
    if (kept !== null) return kept as KeptEvent
    const fixed = calendarId === GCAL_SANDBOX_PRIMARY ? GCAL_SANDBOX_EVENTS.find((one) => one.eventId === eventId) : undefined
    return fixed === undefined ? null : { summary: fixed.summary, start: fixed.start, end: fixed.end, cancelled: false }
}

/** The ids of the events a calendar holds: the fixed week's (primary only), then the ones the account made there. */
const idsOf = async (state: SandboxState, calendarId: string): Promise<ReadonlyArray<string>> => {
    const made = (await state.read(MADE, calendarId)) as ReadonlyArray<string> | null
    const fixed = calendarId === GCAL_SANDBOX_PRIMARY ? GCAL_SANDBOX_EVENTS.map((one) => one.eventId) : []
    return [...fixed, ...(made ?? [])]
}

const eventOf = (calendarId: string, eventId: string, kept: KeptEvent): CalendarEvent => ({
    calendarId,
    eventId,
    status: "confirmed",
    link: `${GCAL_SANDBOX_LINK_BASE}${eventId}`,
    summary: kept.summary,
    start: kept.start,
    end: kept.end,
})

@Injectable()
/**
 * Google Calendar's SANDBOX implementation of the generic calendar purpose (`CalendarPort`; owner rulings R56, R59, R60): used when the
 * Google account is a sandbox account. It answers through the generic sandbox frame from the hardcoded `GCAL-<n>` catalogue and never
 * reaches a host. The primary calendar holds the FIXED week 16-22 Nov 2026 (five events); `calendar-trong` is empty;
 * `calendar-het-han` and `calendar-khong-co` are refused on every operation (`auth_refused` / `not_found`, `not_sent`, as the live twin).
 * `busy` answers the non-cancelled events overlapping the window, the fixed ones as the account changed them plus the ones it made.
 * `createEvent` keeps the event in state (id: the caller's, else `sbev<n>` by the creates the account took) and refuses an id that
 * already exists `rejected` (the live 409 duplicate: Calendar does not refuse overlapping times, nor does the sandbox); `updateEvent`
 * changes only what is set; `cancelEvent` cancels once and answers `cancelled: false` the second time (the live 410), `not_found` for an
 * event the calendar never held. The sandbox adds no idempotency.
 */
export class GoogleCalendarSandboxService implements CalendarPort {
    /** The provider key. */
    readonly provider: string = PROVIDER.google

    constructor(private readonly sandbox: ProviderSandboxService) {}

    /** The busy ranges of one calendar in a window through exactly one sandbox call keyed by the calendar. */
    async busy(connection: ConnectionRecord, query: CalendarBusyQuery): Promise<CalendarBusy> {
        const calendarId = query.calendarId ?? GCAL_SANDBOX_PRIMARY
        return await this.sandbox.call(connection, BUSY_OPERATION, query, {
            key: calendarId,
            answer: async (state) => {
                assertCalendar(calendarId)
                const from = Date.parse(query.windowStart)
                const to = Date.parse(query.windowEnd)
                const busy: Array<{ start: string; end: string }> = []
                for (const eventId of await idsOf(state, calendarId)) {
                    const kept = await eventAt(state, calendarId, eventId)
                    if (kept === null || kept.cancelled || kept.start === null || kept.end === null) continue
                    if (Date.parse(kept.start) < to && Date.parse(kept.end) > from) busy.push({ start: kept.start, end: kept.end })
                }
                return { calendarId, busy }
            },
        })
    }

    /** Makes one event through exactly one sandbox call keyed by the caller's event id. */
    async createEvent(connection: ConnectionRecord, request: CalendarEventRequest): Promise<CalendarEvent> {
        const calendarId = request.calendarId ?? GCAL_SANDBOX_PRIMARY
        return await this.sandbox.call(connection, CREATE_OPERATION, request, {
            key: request.eventId ?? "",
            answer: async (state) => {
                assertCalendar(calendarId)
                const eventId = request.eventId ?? `sbev${String(state.seq + 1).padStart(6, "0")}`
                if ((await eventAt(state, calendarId, eventId)) !== null) throw refused("rejected", GCAL_SANDBOX_DUPLICATE_DETAIL)
                const kept: KeptEvent = { summary: request.summary, start: request.start.dateTime, end: request.end.dateTime, cancelled: false }
                await state.write(EVENT, keyOf(calendarId, eventId), kept)
                const made = ((await state.read(MADE, calendarId)) as ReadonlyArray<string> | null) ?? []
                await state.write(MADE, calendarId, [...made, eventId])
                return eventOf(calendarId, eventId, kept)
            },
        })
    }

    /** Changes one event (only what is set) through exactly one sandbox call keyed by the event id. */
    async updateEvent(connection: ConnectionRecord, change: CalendarEventChange): Promise<CalendarEvent> {
        const calendarId = change.calendarId ?? GCAL_SANDBOX_PRIMARY
        return await this.sandbox.call(connection, UPDATE_OPERATION, change, {
            key: change.eventId,
            answer: async (state) => {
                assertCalendar(calendarId)
                const held = await eventAt(state, calendarId, change.eventId)
                if (held === null || held.cancelled) throw refused("not_found", "Not Found")
                const kept: KeptEvent = {
                    ...held,
                    summary: change.summary ?? held.summary,
                    start: change.start?.dateTime ?? held.start,
                    end: change.end?.dateTime ?? held.end,
                }
                await state.write(EVENT, keyOf(calendarId, change.eventId), kept)
                return eventOf(calendarId, change.eventId, kept)
            },
        })
    }

    /** Cancels one event through exactly one sandbox call keyed by the event id; `cancelled` is false when it was already gone. */
    async cancelEvent(
        connection: ConnectionRecord,
        request: { readonly calendarId: string | null; readonly eventId: string; readonly notifyGuests: boolean },
    ): Promise<CancelAnswer> {
        const calendarId = request.calendarId ?? GCAL_SANDBOX_PRIMARY
        return await this.sandbox.call(connection, CANCEL_OPERATION, request, {
            key: request.eventId,
            answer: async (state) => {
                assertCalendar(calendarId)
                const held = await eventAt(state, calendarId, request.eventId)
                if (held === null) throw refused("not_found", "Not Found")
                if (held.cancelled) return { calendarId, eventId: request.eventId, cancelled: false }
                await state.write(EVENT, keyOf(calendarId, request.eventId), { ...held, cancelled: true })
                return { calendarId, eventId: request.eventId, cancelled: true }
            },
        })
    }
}
