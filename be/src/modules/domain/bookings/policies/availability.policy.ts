import type {
    BookingResource,
    DateException,
    FreeSlot,
    PlanInput,
    SlotReason,
    TakenSpan,
    WeeklyHours,
} from "../bookings.contracts"
import { addDays, hhmmOf, isoWeekday, localDate, zonedMs } from "./zoned-time.policy"

const MINUTE_MS = 60_000
const DAY_MS = 86_400_000

/** A working window of one resource on one local date, in instants. */
export interface OpenWindow {
    /** The opening instant. */
    readonly startMs: number
    /** The closing instant. */
    readonly endMs: number
}

/** The answer of a check of one exact start time. */
export type SlotCheck =
    { readonly ok: true; readonly slot: FreeSlot } | { readonly ok: false; readonly why: Exclude<SlotReason, "free"> }

/** The booked and open minutes of one resource over a date range. */
export interface ResourceUtilisation {
    /** The resource. */
    readonly resourceId: string
    /** The name of the resource. */
    readonly name: string
    /** The minutes the resource is open. */
    readonly openMin: number
    /** The booked minutes, weighted by party size. */
    readonly bookedMin: number
    /** The booked share of the open capacity, 0 to 100. */
    readonly pct: number
}

interface Candidate extends FreeSlot {
    readonly ratio: number
}

/** The windows a resource works on one local date: its own exception, else the business exception, else its weekly hours. */
export const windowsOf = (
    resource: BookingResource,
    date: string,
    hours: ReadonlyArray<WeeklyHours>,
    exceptions: ReadonlyArray<DateException>,
    timeZone: string,
): ReadonlyArray<OpenWindow> => {
    const onDate = exceptions.filter((e) => e.date === date)
    const own = onDate.filter((e) => e.resourceId === resource.id)
    const exception = own.length > 0 ? own : onDate.filter((e) => e.resourceId === null)
    if (exception.some((e) => e.closed)) return []
    const openExceptions = exception.flatMap((e) =>
        e.start !== null && e.end !== null ? [{ start: hhmmOf(e.start), end: hhmmOf(e.end) }] : [],
    )
    const raw =
        openExceptions.length > 0
            ? openExceptions
            : hours
                  .filter((h) => h.resourceId === resource.id && h.weekday === isoWeekday(date))
                  .map((h) => ({ start: hhmmOf(h.start), end: hhmmOf(h.end) }))
    return raw
        .map((w) => ({ startMs: zonedMs(date, w.start, timeZone), endMs: zonedMs(date, w.end, timeZone) }))
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
        ...moments.map((at) =>
            mine.filter((t) => t.startMs <= at && t.blockEndMs > at).reduce((sum, t) => sum + t.partySize, 0),
        ),
    )
}

const eligible = (input: Pick<PlanInput, "service" | "resources" | "resourceId">): ReadonlyArray<BookingResource> =>
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
    const last = addDays(localDate(toMs, timeZone), 1)
    for (let date = addDays(localDate(fromMs, timeZone), -1); date <= last; date = addDays(date, 1)) dates.push(date)
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
    const dates = datesAround(from, to, policy.timezone)
    const found: Array<Candidate> = []
    for (const resource of eligible(input).filter((r) => r.capacity >= party)) {
        for (const date of dates) {
            for (const window of windowsOf(resource, date, hours, exceptions, policy.timezone)) {
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
    candidates(input, fromMs, toMs).map(plain)

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
    const date = localDate(startMs, policy.timezone)
    const duration = service.durationMin * MINUTE_MS
    const opened = resources.some((r) =>
        windowsOf(r, date, input.hours, input.exceptions, policy.timezone).some(
            (w) => startMs >= w.startMs && startMs + duration <= w.endMs,
        ),
    )
    return { ok: false, why: opened ? "full" : "closed" }
}

/** The nearest distinct free start times around a wanted time, at most `count`, sorted by time. */
export const nearestSlots = (
    input: PlanInput,
    wantedMs: number,
    count: number,
    spanDays: number,
): ReadonlyArray<FreeSlot> => {
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

/** Booked minutes over open minutes for each active resource between two local dates. */
export const utilisation = (
    resources: ReadonlyArray<BookingResource>,
    hours: ReadonlyArray<WeeklyHours>,
    exceptions: ReadonlyArray<DateException>,
    bookedByResource: ReadonlyMap<string, number>,
    fromDate: string,
    toDate: string,
    timeZone: string,
): ReadonlyArray<ResourceUtilisation> =>
    resources
        .filter((r) => r.active)
        .map((r) => {
            let openMin = 0
            for (let date = fromDate; date <= toDate; date = addDays(date, 1)) {
                for (const w of windowsOf(r, date, hours, exceptions, timeZone))
                    openMin += (w.endMs - w.startMs) / MINUTE_MS
            }
            const bookedMin = bookedByResource.get(r.id) ?? 0
            return {
                resourceId: r.id,
                name: r.name,
                openMin,
                bookedMin,
                pct: openMin > 0 ? Math.min(100, Math.round((bookedMin / (openMin * r.capacity)) * 100)) : 0,
            }
        })
