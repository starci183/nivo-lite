import { zoneDayOf, zoneMomentMs } from "../zone-time"

/*
 * The availability of a booking calendar, pure: the free start times of a service from the weekly hours, the date exceptions and the
 * bookings that already hold a resource. Carried from the back end's booking availability policy; times are instants (epoch ms), days
 * are `YYYY-MM-DD` in the workspace's time zone, clock times `HH:MM`.
 */

const MINUTE_MS = 60_000
const DAY_MS = 86_400_000

/** A person or a room that takes bookings. */
export interface SlotResource {
    /** The resource id. */
    readonly id: string
    /** The name shown to people. */
    readonly name: string
    /** What it is (`person`, `room`); a service may ask for one kind. */
    readonly kind: string
    /** How many customers it serves at the same moment. */
    readonly capacity: number
    /** Whether it takes bookings. */
    readonly active: boolean
    /** The display and tie-break order. */
    readonly sort: number
}

/** A weekly opening window of one resource. */
export interface WeeklyWindow {
    /** The resource the window belongs to. */
    readonly resourceId: string
    /** The ISO weekday, 1 is Monday and 7 is Sunday. */
    readonly weekday: number
    /** The opening time, `HH:MM`. */
    readonly start: string
    /** The closing time, `HH:MM`. */
    readonly end: string
}

/** A closing, or a different opening window, on one date; a null `resourceId` is the whole business. */
export interface DateException {
    /** The resource, or null for the whole business. */
    readonly resourceId: string | null
    /** The local date, `YYYY-MM-DD`. */
    readonly date: string
    /** Whether the date is closed. */
    readonly closed: boolean
    /** The opening time of an open exception, `HH:MM`. */
    readonly start: string | null
    /** The closing time of an open exception, `HH:MM`. */
    readonly end: string | null
}

/** What the planner needs to know of a service. */
export interface SlotService {
    /** The service id. */
    readonly id: string
    /** The visit length in minutes. */
    readonly durationMin: number
    /** The rest after the visit in minutes; the resource stays blocked for it. */
    readonly bufferMin: number
    /** The resource kind the service needs, or null for any resource. */
    readonly resourceKind: string | null
    /** Whether the service takes bookings. */
    readonly active: boolean
}

/** A span that already holds a resource. */
export interface TakenSpan {
    /** The booking id. */
    readonly id: string
    /** The resource the span takes. */
    readonly resourceId: string
    /** The start instant. */
    readonly startMs: number
    /** The instant the resource is free again, buffer included. */
    readonly blockEndMs: number
    /** How many customers the span holds. */
    readonly partySize: number
}

/** The rules of the calendar. */
export interface SlotPolicy {
    /** The IANA time zone of the business. */
    readonly timeZone: string
    /** The step between start times, in minutes. */
    readonly slotStepMin: number
    /** The earliest a customer may book, in minutes from now. */
    readonly minLeadMin: number
    /** How far ahead a customer may book, in days. */
    readonly maxAdvanceDays: number
}

/** One free start time on one resource. */
export interface FreeSlot {
    /** The start instant. */
    readonly startMs: number
    /** The end of the visit. */
    readonly endMs: number
    /** The end of the visit plus the buffer. */
    readonly blockEndMs: number
    /** The resource that takes the visit. */
    readonly resourceId: string
}

/** Why a start time cannot be taken. */
export type SlotRefusal = "no_service" | "no_resource" | "too_soon" | "too_far" | "closed" | "full"

/** Everything the planner reads. */
export interface PlanInput {
    /** The service to plan. */
    readonly service: SlotService
    /** Every resource of the business. */
    readonly resources: ReadonlyArray<SlotResource>
    /** The weekly hours of every resource. */
    readonly hours: ReadonlyArray<WeeklyWindow>
    /** The date exceptions. */
    readonly exceptions: ReadonlyArray<DateException>
    /** The spans that already hold resources. */
    readonly taken: ReadonlyArray<TakenSpan>
    /** The rules of the calendar. */
    readonly policy: SlotPolicy
    /** The instant the plan is made. */
    readonly nowMs: number
    /** How many customers come; one when omitted. */
    readonly partySize?: number | undefined
    /** Only this resource, when a customer asks for one. */
    readonly resourceId?: string | null | undefined
    /** The booking being moved, which does not block itself. */
    readonly excludeId?: string | null | undefined
}

/** A working window of one resource on one local date, in instants. */
export interface OpenWindow {
    /** The opening instant. */
    readonly startMs: number
    /** The closing instant. */
    readonly endMs: number
}

/** The answer of a check of one exact start time. */
export type SlotCheck = { readonly ok: true; readonly slot: FreeSlot } | { readonly ok: false; readonly why: SlotRefusal }

interface Candidate extends FreeSlot {
    readonly ratio: number
}

/** The ISO weekday of a date (`YYYY-MM-DD`): 1 is Monday, 7 is Sunday. */
export const isoWeekday = (date: string): number => {
    const day = new Date(`${date}T00:00:00.000Z`).getUTCDay()
    return day === 0 ? 7 : day
}

/** The date `days` after a date (`YYYY-MM-DD`), negative for before. */
export const addDays = (date: string, days: number): string =>
    new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10)

/** The minutes after midnight of a clock time (`HH:MM`, seconds ignored). */
const minuteOf = (time: string): number => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

/** The instant of a clock time on a date in a zone. */
const momentOf = (date: string, time: string, timeZone: string): number => zoneMomentMs(date, minuteOf(time), timeZone)

/** The windows a resource works on one local date: its own exception, else the business exception, else its weekly hours. */
export const windowsOf = (
    resource: SlotResource,
    date: string,
    hours: ReadonlyArray<WeeklyWindow>,
    exceptions: ReadonlyArray<DateException>,
    timeZone: string,
): ReadonlyArray<OpenWindow> => {
    const onDate = exceptions.filter((e) => e.date === date)
    const own = onDate.filter((e) => e.resourceId === resource.id)
    const exception = own.length > 0 ? own : onDate.filter((e) => e.resourceId === null)
    if (exception.some((e) => e.closed)) return []
    const openExceptions = exception.flatMap((e) => (e.start !== null && e.end !== null ? [{ start: e.start, end: e.end }] : []))
    const raw =
        openExceptions.length > 0
            ? openExceptions
            : hours
                  .filter((h) => h.resourceId === resource.id && h.weekday === isoWeekday(date))
                  .map((h) => ({ start: h.start, end: h.end }))
    return raw
        .map((w) => ({ startMs: momentOf(date, w.start, timeZone), endMs: momentOf(date, w.end, timeZone) }))
        .filter((w) => w.endMs > w.startMs)
        .sort((a, b) => a.startMs - b.startMs)
}

/** The most customers at one moment inside [startMs, blockEndMs) on a resource. */
export const peakLoad = (
    taken: ReadonlyArray<TakenSpan>,
    resourceId: string,
    startMs: number,
    blockEndMs: number,
    excludeId: string | null,
): number => {
    const mine = taken.filter(
        (t) => t.resourceId === resourceId && t.id !== excludeId && t.startMs < blockEndMs && t.blockEndMs > startMs,
    )
    const moments = [startMs, ...mine.map((t) => t.startMs).filter((s) => s > startMs && s < blockEndMs)]
    return Math.max(
        ...moments.map((at) => mine.filter((t) => t.startMs <= at && t.blockEndMs > at).reduce((sum, t) => sum + t.partySize, 0)),
    )
}

const eligible = (input: Pick<PlanInput, "service" | "resources" | "resourceId">): ReadonlyArray<SlotResource> =>
    input.resources
        .filter(
            (r) =>
                r.active &&
                (input.resourceId ? r.id === input.resourceId : true) &&
                (input.service.resourceKind ? r.kind === input.service.resourceKind : true),
        )
        .slice()
        .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))

const datesAround = (fromMs: number, toMs: number, timeZone: string): ReadonlyArray<string> => {
    const dates: Array<string> = []
    const last = addDays(zoneDayOf(toMs, timeZone), 1)
    for (let date = addDays(zoneDayOf(fromMs, timeZone), -1); date <= last; date = addDays(date, 1)) dates.push(date)
    return dates
}

const candidates = (input: PlanInput, fromMs: number, toMs: number): ReadonlyArray<Candidate> => {
    const { service, hours, exceptions, taken, policy, nowMs } = input
    const party = Math.max(1, input.partySize ?? 1)
    const from = Math.max(fromMs, nowMs + policy.minLeadMin * MINUTE_MS)
    const to = Math.min(toMs, nowMs + policy.maxAdvanceDays * DAY_MS)
    if (!service.active || to <= from) return []
    const step = Math.max(5, policy.slotStepMin) * MINUTE_MS
    const duration = service.durationMin * MINUTE_MS
    const buffer = service.bufferMin * MINUTE_MS
    const found: Array<Candidate> = []
    const addWindow = (resource: SlotResource, window: OpenWindow): void => {
        for (let start = window.startMs; start + duration <= window.endMs; start += step) {
            if (start < from || start >= to) continue
            const load = peakLoad(taken, resource.id, start, start + duration + buffer, input.excludeId ?? null)
            if (load + party > resource.capacity) continue
            found.push({
                startMs: start,
                endMs: start + duration,
                blockEndMs: start + duration + buffer,
                resourceId: resource.id,
                ratio: load / resource.capacity,
            })
        }
    }
    for (const resource of eligible(input).filter((r) => r.capacity >= party)) {
        for (const date of datesAround(from, to, policy.timeZone)) {
            for (const window of windowsOf(resource, date, hours, exceptions, policy.timeZone)) addWindow(resource, window)
        }
    }
    return found.sort((a, b) => a.startMs - b.startMs || a.resourceId.localeCompare(b.resourceId))
}

const plain = (c: Candidate): FreeSlot => ({
    startMs: c.startMs,
    endMs: c.endMs,
    blockEndMs: c.blockEndMs,
    resourceId: c.resourceId,
})

/** Every free start time of a service between two instants, earliest first. */
export const findSlots = (input: PlanInput, fromMs: number, toMs: number): ReadonlyArray<FreeSlot> =>
    candidates(input, fromMs, toMs).map((candidate) => plain(candidate))

/** One free resource at an exact start (the least loaded, then the first in order), or the reason there is none. */
export const checkSlot = (input: PlanInput, startMs: number): SlotCheck => {
    const { service, policy, nowMs } = input
    const resources = eligible(input)
    if (!service.active) return { ok: false, why: "no_service" }
    if (resources.length === 0) return { ok: false, why: "no_resource" }
    if (startMs < nowMs + policy.minLeadMin * MINUTE_MS) return { ok: false, why: "too_soon" }
    if (startMs > nowMs + policy.maxAdvanceDays * DAY_MS) return { ok: false, why: "too_far" }
    const exact = candidates(input, startMs, startMs + 1).filter((c) => c.startMs === startMs)
    const best = exact.reduce<Candidate | null>((pick, c) => (pick === null || c.ratio < pick.ratio ? c : pick), null)
    if (best !== null) return { ok: true, slot: plain(best) }
    const date = zoneDayOf(startMs, policy.timeZone)
    const duration = service.durationMin * MINUTE_MS
    const opened = resources.some((r) =>
        windowsOf(r, date, input.hours, input.exceptions, policy.timeZone).some(
            (w) => startMs >= w.startMs && startMs + duration <= w.endMs,
        ),
    )
    return { ok: false, why: opened ? "full" : "closed" }
}

/** The nearest distinct free start times around a wanted time, at most `count`, sorted by time. */
export const nearestSlots = (input: PlanInput, wantedMs: number, count: number, spanDays: number): ReadonlyArray<FreeSlot> => {
    const span = spanDays * DAY_MS
    const byDistance = findSlots(input, wantedMs - span / 2, wantedMs + span)
        .slice()
        .sort((a, b) => Math.abs(a.startMs - wantedMs) - Math.abs(b.startMs - wantedMs) || a.startMs - b.startMs)
    const seen = new Set<number>()
    const distinct: Array<FreeSlot> = []
    for (const slot of byDistance) {
        if (distinct.length >= count) break
        if (!seen.has(slot.startMs)) {
            seen.add(slot.startMs)
            distinct.push(slot)
        }
    }
    return distinct.sort((a, b) => a.startMs - b.startMs)
}

/** The distinct earliest free start times of a service from an instant, at most `count`, one resource each (the first free). */
export const firstSlots = (input: PlanInput, fromMs: number, toMs: number, count: number): ReadonlyArray<FreeSlot> => {
    const seen = new Set<number>()
    const distinct: Array<FreeSlot> = []
    for (const slot of findSlots(input, fromMs, toMs)) {
        if (distinct.length >= count) break
        if (!seen.has(slot.startMs)) {
            seen.add(slot.startMs)
            distinct.push(slot)
        }
    }
    return distinct
}
