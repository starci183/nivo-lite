import { vnParts, vnToIso } from "@modules/domain/content"
import { CONTENT_AI_CALENDAR, CONTENT_AI_CHANNELS } from "./content-ai.templates"
import { ContentAiError, ContentAiErrorCode } from "./errors/content-ai.error"

/** A supported social channel. */
export type PlanChannel = (typeof CONTENT_AI_CHANNELS)[number]

/** The pillar fields needed by the weighted planner. */
export interface PlanPillar {
    /** Stable identifier of the referenced content item or pillar. */
    readonly id: string
    /** Human-readable name used in the planning instructions. */
    readonly name: string
    /** Editorial scope of this content theme. */
    readonly description: string
    /** Relative share of posts assigned to this pillar. */
    readonly weight: number
    /** Whether this pillar participates in the content plan. */
    readonly active: boolean
}

/** The posting rhythm of one channel; weekdays are Monday = 1 through Sunday = 7. */
export interface PlanCadence {
    /** Social channel whose cadence is being scheduled. */
    readonly channel: PlanChannel
    /** Requested weekly frequency used to choose default weekdays. */
    readonly postsPerWeek: number
    /** Selected ISO weekdays, Monday = 1 through Sunday = 7. */
    readonly days: ReadonlyArray<number>
    /** Vietnam wall-clock posting time, formatted HH:mm. */
    readonly time: string
}

/** All channels scheduled at one instant, numbered in chronological order. */
export interface PlanSlot {
    /** One-based slot number preserved in model responses. */
    readonly n: number
    /** Scheduled posting instant in UTC ISO 8601 format. */
    readonly at: string
    /** Social channels selected by this content context. */
    readonly channels: ReadonlyArray<PlanChannel>
}

/** A dated occasion whose angle must not imply an unrecorded offer. */
export interface PlanEvent {
    /** Stable calendar occasion key persisted on the post. */
    readonly key: string
    /** Calendar occasion date formatted YYYY-MM-DD. */
    readonly date: string
    /** Human-readable name used in the planning instructions. */
    readonly name: string
    /** Permitted editorial angle without an implied promotion. */
    readonly angle: string
    /** Preparation window before the occasion, in days. */
    readonly leadDays?: number
}

/** A deterministic slot enriched with its theme and pinned occasion. */
export interface PlannedSlot extends PlanSlot {
    /** Pillar assigned to this slot or selected for the draft. */
    readonly pillar: PlanPillar
    /** Pinned occasion, or null when none applies. */
    readonly holiday: PlanEvent | null
}

/** The result used to build and persist a monthly plan. */
export interface PlannedMonth {
    /** Deterministic future posting slots enriched with themes. */
    readonly slots: ReadonlyArray<PlannedSlot>
    /** Dated calendar occasions relevant to the plan month. */
    readonly events: ReadonlyArray<PlanEvent>
    /** Weighted whole-post allocations for participating pillars. */
    readonly quota: ReadonlyArray<PillarShare>
    /** Individual channel slots excluded because their time has passed. */
    readonly skippedPast: number
}

/** A pillar's whole-post quota. */
export interface PillarShare {
    /** Pillar assigned to this slot or selected for the draft. */
    readonly pillar: PlanPillar
    /** Number of posts allocated to the referenced pillar. */
    readonly count: number
}

/** A calendar year and one-based month. */
export interface YearMonth {
    /** Calendar year in Vietnam time. */
    readonly y: number
    /** One-based calendar month in Vietnam time. */
    readonly m: number
}

/** Vietnam wall-clock fields of an instant. */
export interface VnParts extends YearMonth {
    /** Day of the calendar month. */
    readonly day: number
    /** Hour of the Vietnam wall clock. */
    readonly h: number
    /** Minute of the Vietnam wall clock. */
    readonly min: number
    /** Weekday with Sunday = 0 through Saturday = 6. */
    readonly dow: number
}

/** A half-open UTC range used for month content reads. */
export interface MonthRange {
    /** Inclusive UTC lower bound of the selected month. */
    readonly from: string
    /** Exclusive UTC upper bound of the selected month. */
    readonly to: string
}

type CalendarEvent = (typeof CONTENT_AI_CALENDAR)[number]

interface ChannelSlot {
    /** Social channel whose cadence is being scheduled. */
    readonly channel: PlanChannel
    /** Scheduled posting instant in UTC ISO 8601 format. */
    readonly at: string
}

const DAY_MS = 86_400_000
const DEFAULT_DAYS: ReadonlyArray<ReadonlyArray<number>> = [
    [3],
    [2, 5],
    [2, 4, 6],
    [1, 3, 5, 6],
    [1, 2, 4, 5, 6],
    [1, 2, 3, 4, 5, 6],
    [1, 2, 3, 4, 5, 6, 7],
]

const PLAN_CHANNEL_VALUES: ReadonlyArray<unknown> = CONTENT_AI_CHANNELS

/** Checks a stored or incoming channel. */
export const isPlanChannel = (value: unknown): value is PlanChannel => PLAN_CHANNEL_VALUES.includes(value)

/** Parses a plausible YYYY-MM month. */
export const parseMonth = (value: string): YearMonth | null => {
    const match = /^(\d{4})-(\d{2})$/u.exec(value)
    if (match === null) return null
    const y = Number(match[1])
    const m = Number(match[2])
    return m >= 1 && m <= 12 && y >= 2020 && y <= 2100 ? { y, m } : null
}

/** The UTC instant corresponding to a Vietnam wall-clock time. */
export { vnToIso } from "@modules/domain/content"

/** Vietnam calendar fields, without using the host's timezone. */
export const vietnamClock = (date: Date): VnParts => vnParts(date)

/** The half-open UTC range of a Vietnam calendar month. */
export const monthRange = (y: number, m: number): MonthRange => ({
    from: vnToIso(y, m, 1),
    to: vnToIso(y, m + 1, 1),
})

const pad2 = (n: number): string => String(n).padStart(2, "0")
const dayNumber = (iso: string): number => {
    const p = vietnamClock(new Date(iso))
    return Math.floor(Date.UTC(p.y, p.m - 1, p.day) / DAY_MS)
}

const eventDate = (event: CalendarEvent, year: number): string | null => {
    if ("fixed" in event) return `${year}-${pad2(event.fixed.month)}-${pad2(event.fixed.day)}`
    if ("nth" in event) {
        const first = new Date(Date.UTC(year, event.nth.month - 1, 1)).getUTCDay()
        const day = 1 + ((event.nth.weekday - first + 7) % 7) + (event.nth.n - 1) * 7
        return `${year}-${pad2(event.nth.month)}-${pad2(day)}`
    }
    return Object.entries(event.dates).find(([name]) => name === String(year))?.[1] ?? null
}

/** Month occasions plus the next month's occasions whose capped preparation window overlaps this month. */
export const eventsForMonth = (y: number, m: number): Array<PlanEvent> => {
    const start = Date.UTC(y, m - 1, 1)
    const end = Date.UTC(y, m, 0)
    return CONTENT_AI_CALENDAR.flatMap((event: CalendarEvent) =>
        [y, y + 1].flatMap((year) => {
            const date = eventDate(event, year)
            if (date === null) return []
            const at = Date.parse(`${date}T00:00:00Z`)
            return (at >= start && at <= end) || (at > end && at - end <= Math.min(event.leadDays, 14) * DAY_MS)
                ? [{ key: event.key, date, name: event.name, angle: event.angle, leadDays: event.leadDays }]
                : []
        }),
    ).sort((a, b) => a.date.localeCompare(b.date))
}

/** Resolves cadence to individual channel slots, retaining the previous planner's weekday distribution. */
export const slotsForMonth = (
    y: number,
    m: number,
    cadence: ReadonlyArray<PlanCadence>,
    from: Date,
): Array<ChannelSlot> => {
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
    return cadence
        .filter((c) => c.postsPerWeek > 0)
        .flatMap((c) => {
            const [h, min] = c.time.split(":").map(Number)
            const days =
                c.days.length > 0 ? c.days : (DEFAULT_DAYS[Math.min(7, Math.max(1, c.postsPerWeek)) - 1] ?? [3])
            return Array.from({ length: daysInMonth }, (_, i) => i + 1)
                .filter((day) => days.includes(new Date(Date.UTC(y, m - 1, day)).getUTCDay() || 7))
                .map((day) => ({ channel: c.channel, at: vnToIso(y, m, day, h, min) }))
                .filter((slot) => Date.parse(slot.at) >= from.getTime())
        })
        .sort((a, b) => a.at.localeCompare(b.at))
}

/** Groups same-instant slots so one idea can have several channel variants. */
export const groupSlots = (slots: ReadonlyArray<ChannelSlot>): Array<PlanSlot> => {
    const by = new Map<string, Array<PlanChannel>>()
    for (const slot of slots) by.set(slot.at, [...(by.get(slot.at) ?? []), slot.channel])
    return [...by.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([at, channels], i) => ({ n: i + 1, at, channels }))
}

/** Allocates every post using largest-remainder weighted quotas. */
export const pillarQuota = (pillars: ReadonlyArray<PlanPillar>, total: number): Array<PillarShare> => {
    const active = pillars.filter((p) => p.active && p.weight > 0)
    const sum = active.reduce((s, p) => s + p.weight, 0)
    if (active.length === 0 || total <= 0) return []
    const rows = active.map((pillar) => {
        const exact = (pillar.weight / sum) * total
        return { pillar, count: Math.floor(exact), rem: exact - Math.floor(exact) }
    })
    const left = total - rows.reduce((s, r) => s + r.count, 0)
    const bumped = new Set(
        [...rows]
            .sort((a, b) => b.rem - a.rem)
            .slice(0, Math.max(0, left))
            .map((r) => r.pillar.id),
    )
    return rows.map(({ pillar, count }) => ({ pillar, count: bumped.has(pillar.id) ? count + 1 : count }))
}

/** Orders quota choices so a repeated theme is avoided while another still has posts remaining. */
export const themeSequence = (quota: ReadonlyArray<PillarShare>, total: number): Array<PlanPillar> => {
    const left = quota.map((q) => ({ pillar: q.pillar, n: q.count }))
    return Array.from({ length: total }).reduce<Array<PlanPillar>>((out) => {
        const previous = out.at(-1)
        const candidates = left.filter((x) => x.n > 0).sort((a, b) => b.n - a.n)
        const pick = candidates.find((x) => x.pillar.id !== previous?.id) ?? candidates[0]
        if (pick === undefined) return out
        pick.n -= 1
        return [...out, pick.pillar]
    }, [])
}

/** Pins an occasion to the last free slot within seven lead days, or the first free slot in the following two days. */
export const pinHolidays = (
    slots: ReadonlyArray<PlanSlot>,
    holidays: ReadonlyArray<PlanEvent>,
): Map<number, string> => {
    const pinned = new Map<number, string>()
    for (const holiday of holidays) {
        const day = Math.floor(Date.parse(`${holiday.date}T00:00:00Z`) / DAY_MS)
        const free = slots.filter((s) => !pinned.has(s.n))
        const before = free.filter(
            (s) => dayNumber(s.at) <= day && dayNumber(s.at) >= day - Math.min(holiday.leadDays ?? 0, 7),
        )
        const after = free.find((s) => dayNumber(s.at) > day && dayNumber(s.at) <= day + 2)
        const pick = before.at(-1) ?? after
        if (pick !== undefined) pinned.set(pick.n, holiday.key)
    }
    return pinned
}

/** Settles the schedule, weights and holiday assignments before asking a model to write ideas. */
export const planSlots = (
    month: string,
    cadence: ReadonlyArray<PlanCadence>,
    pillars: ReadonlyArray<PlanPillar>,
    now: Date,
): PlannedMonth => {
    const parsed = parseMonth(month)
    if (parsed === null) throw new ContentAiError({ code: ContentAiErrorCode.InvalidInput })
    const all = slotsForMonth(parsed.y, parsed.m, cadence, new Date(0))
    const upcoming = slotsForMonth(parsed.y, parsed.m, cadence, now)
    const slots = groupSlots(upcoming)
    const events = eventsForMonth(parsed.y, parsed.m)
    const quota = pillarQuota(pillars, slots.length)
    const themes = themeSequence(quota, slots.length)
    const pinned = pinHolidays(slots, events)
    return {
        slots: slots.flatMap((slot) => {
            const pillar = themes[slot.n - 1]
            return pillar === undefined
                ? []
                : [{ ...slot, pillar, holiday: events.find((h) => h.key === pinned.get(slot.n)) ?? null }]
        }),
        events,
        quota,
        skippedPast: all.length - upcoming.length,
    }
}
