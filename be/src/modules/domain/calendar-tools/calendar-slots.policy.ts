/**
 * The EXACT arithmetic that turns a calendar's busy ranges into free slots: no model, no provider. A window, an optional daily
 * window (opening hours in a zone), a slot length and a step; the busy ranges the provider answered (`start` inclusive, `end` exclusive,
 * https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query). Integer milliseconds throughout; slots are the
 * times a `durationMs` event could start and end inside one free stretch, `stepMs` apart from the stretch's start.
 */
import { attempt } from "@modules/platform/primitives"

/** A range of instants, `start` inclusive and `end` exclusive, in epoch milliseconds. */
export interface Span {
    /** The first instant of the span, in epoch milliseconds. */
    readonly start: number
    /** The instant the span ends, in epoch milliseconds. */
    readonly end: number
}

/** Opening hours inside a day, as minutes after local midnight, in a zone. */
export interface DailyHours {
    /** Minutes after local midnight the day opens (0..1439). */
    readonly fromMinutes: number
    /** Minutes after local midnight the day closes (1..1440), after `fromMinutes`. */
    readonly toMinutes: number
    /** The IANA zone the hours are told in. */
    readonly timeZone: string
}

/** What a free-slot calculation is asked for. */
export interface SlotQuery {
    /** The window, epoch milliseconds. */
    readonly window: Span
    /** The busy ranges (any order, overlapping or not, may reach outside the window). */
    readonly busy: ReadonlyArray<Span>
    /** The slot length. */
    readonly durationMs: number
    /** The distance between two slot starts inside one free stretch. */
    readonly stepMs: number
    /** The hours each day is open, or null for the whole window. */
    readonly hours: DailyHours | null
    /** The most slots to answer. */
    readonly limit: number
}

/** The slots found. */
export interface SlotResult {
    /** The slots, in time order. */
    readonly slots: ReadonlyArray<Span>
    /** True when more slots exist beyond `limit`. */
    readonly truncated: boolean
}

const MINUTE = 60_000
const DAY_MINUTES = 1440

/** The busy ranges sorted and merged (overlapping or touching ranges become one), empty and inverted ranges dropped. */
export const mergedSpans = (spans: ReadonlyArray<Span>): ReadonlyArray<Span> => {
    const sorted = spans.filter((span) => span.end > span.start).sort((a, b) => a.start - b.start || a.end - b.end)
    const merged: Array<Span> = []
    for (const span of sorted) {
        const last = merged.at(-1)
        if (last !== undefined && span.start <= last.end)
            merged[merged.length - 1] = { start: last.start, end: Math.max(last.end, span.end) }
        else merged.push(span)
    }
    return merged
}

/** `inner` with `outer`'s overlap only, or null when they do not overlap. */
const clamped = (span: Span, outer: Span): Span | null => {
    const start = Math.max(span.start, outer.start)
    const end = Math.min(span.end, outer.end)
    return end > start ? { start, end } : null
}

/** The stretches of `allowed` that no busy range covers. `busy` is merged and sorted. */
const without = (allowed: Span, busy: ReadonlyArray<Span>): ReadonlyArray<Span> => {
    const free: Array<Span> = []
    let cursor = allowed.start
    for (const range of busy) {
        if (range.end <= cursor) continue
        if (range.start >= allowed.end) break
        if (range.start > cursor) free.push({ start: cursor, end: range.start })
        cursor = Math.max(cursor, range.end)
    }
    if (cursor < allowed.end) free.push({ start: cursor, end: allowed.end })
    return free
}

const PARTS = ["year", "month", "day", "hour", "minute", "second"] as const

/** The wall clock of an instant in a zone, as numbers. */
const wallClockOf = (ms: number, timeZone: string): Readonly<Record<(typeof PARTS)[number], number>> => {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
    }).formatToParts(new Date(ms))
    const read = (type: (typeof PARTS)[number]): number =>
        Number(parts.find((part) => part.type === type)?.value ?? "0")
    return {
        year: read("year"),
        month: read("month"),
        day: read("day"),
        hour: read("hour"),
        minute: read("minute"),
        second: read("second"),
    }
}

/** The zone's offset from UTC at an instant, in milliseconds (positive east of UTC). */
export const offsetMsOf = (ms: number, timeZone: string): number => {
    const wall = wallClockOf(ms, timeZone)
    const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second)
    return asUtc - Math.floor(ms / 1000) * 1000
}

/**
 * The instant at which a zone's wall clock reads `minutes` after midnight of the local date `year-month-day`. Settled by applying the
 * offset at the first guess and re-reading it at the result (right across a daylight change on either side); a wall time the zone skips
 * resolves to the instant just after the skip.
 */
export const zonedInstantMs = (year: number, month: number, day: number, minutes: number, timeZone: string): number => {
    const guess = Date.UTC(year, month - 1, day, 0, minutes)
    const first = guess - offsetMsOf(guess, timeZone)
    const second = guess - offsetMsOf(first, timeZone)
    return second
}

/** A calendar date as a year, a month (1 to 12) and a day of the month. */
interface LocalDate {
    /** The year. */
    readonly year: number
    /** The month, 1 to 12. */
    readonly month: number
    /** The day of the month. */
    readonly day: number
}

/** The local calendar date of an instant in a zone. */
const localDateOf = (ms: number, timeZone: string): LocalDate => {
    const wall = wallClockOf(ms, timeZone)
    return { year: wall.year, month: wall.month, day: wall.day }
}

/** The opening spans of every local day the window touches, each cut to the window. */
const openingSpans = (window: Span, hours: DailyHours): ReadonlyArray<Span> => {
    const spans: Array<Span> = []
    const first = localDateOf(window.start, hours.timeZone)
    // The calendar day is stepped in UTC arithmetic on the local date (a local date has no zone), so a daylight change never skips a day.
    let cursor = Date.UTC(first.year, first.month - 1, first.day)
    for (;;) {
        const date = new Date(cursor)
        const year = date.getUTCFullYear()
        const month = date.getUTCMonth() + 1
        const day = date.getUTCDate()
        const open = zonedInstantMs(year, month, day, hours.fromMinutes, hours.timeZone)
        if (open >= window.end) break
        const close =
            hours.toMinutes >= DAY_MINUTES
                ? zonedInstantMs(year, month, day + 1, 0, hours.timeZone)
                : zonedInstantMs(year, month, day, hours.toMinutes, hours.timeZone)
        const cut = clamped({ start: open, end: close }, window)
        if (cut !== null) spans.push(cut)
        cursor += DAY_MINUTES * MINUTE
    }
    return spans
}

/**
 * The free slots of a window: the opening spans (the whole window, or each day's hours) minus the merged busy ranges, then in each
 * free stretch a slot every `stepMs` from its start while a whole `durationMs` still fits. At most `limit` are answered; `truncated`
 * says there were more.
 */
export const freeSlotsOf = (query: SlotQuery): SlotResult => {
    const busy = mergedSpans(query.busy)
    const allowed = query.hours === null ? [query.window] : openingSpans(query.window, query.hours)
    const slots: Array<Span> = []
    let truncated = false
    for (const opening of allowed) {
        for (const stretch of without(opening, busy)) {
            for (let start = stretch.start; start + query.durationMs <= stretch.end; start += query.stepMs) {
                if (slots.length >= query.limit) {
                    truncated = true
                    return { slots, truncated }
                }
                slots.push({ start, end: start + query.durationMs })
            }
        }
    }
    return { slots, truncated }
}

const pad = (value: number, width = 2): string => String(value).padStart(width, "0")

/** An instant as RFC 3339 with the zone's own offset at that instant (`Z` for UTC), seconds precision. */
export const isoInZone = (ms: number, timeZone: string): string => {
    const offset = offsetMsOf(ms, timeZone)
    const wall = new Date(Math.floor(ms / 1000) * 1000 + offset)
    const stamp = `${pad(wall.getUTCFullYear(), 4)}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}T${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}:${pad(wall.getUTCSeconds())}`
    if (offset === 0) return `${stamp}Z`
    const minutes = Math.abs(offset) / MINUTE
    return `${stamp}${offset < 0 ? "-" : "+"}${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
}

/** True for an IANA zone name the runtime knows (a form check, not a reading of words). */
export const knownZone = (name: string): boolean =>
    attempt(() => new Intl.DateTimeFormat("en-US", { timeZone: name })).ok

/** The minutes after local midnight of a `HH:mm` clock (24:00 closes the day). */
export const clockMinutesOf = (clock: string): number => {
    const [hours, minutes] = clock.split(":").map(Number)
    return (hours ?? 0) * 60 + (minutes ?? 0)
}
