import calendarJson from "../../../resources/content/calendar-vn.json"
import channelsJson from "../../../resources/content/channels.json"
import presetsJson from "../../../resources/content/pillar-presets.json"
import { daysInMonth, isoWeekdayOf, pad2, vnToIso } from "./time"
import {
    isContentChannel,
    type Cadence,
    type CadencePreset,
    type ChannelRule,
    type ContentChannel,
    type ContentItem,
    type Pillar,
    type PillarPreset,
} from "./types"

/** The per-channel writing rules. */
export const CHANNEL_RULES: ReadonlyArray<ChannelRule> = channelsJson.channels.flatMap((rule) => {
    const key = rule.key
    return isContentChannel(key) ? [{ ...rule, key }] : []
})

/** The rules every post must obey, fed to the writer. */
export const GUARDRAILS: ReadonlyArray<string> = channelsJson.guardrails

/** The rule of one channel (the first channel when none matches). */
export const channelRule = (channel: ContentChannel): ChannelRule =>
    CHANNEL_RULES.find((rule) => rule.key === channel) ?? CHANNEL_RULES[0]

/** The display name of a channel, or the key itself when unknown. */
export const contentChannelLabel = (channel: string): string =>
    CHANNEL_RULES.find((rule) => rule.key === channel)?.label ?? channel

/** Suggested content themes. */
export const PILLAR_PRESETS: ReadonlyArray<PillarPreset> = presetsJson.pillars

/** Suggested posting rhythms. */
export const CADENCE_PRESETS: ReadonlyArray<CadencePreset> = presetsJson.cadence.flatMap((row) => {
    const channel = row.channel
    return isContentChannel(channel) ? [{ ...row, channel }] : []
})

/** A holiday, observance or sale day of the Vietnamese calendar. */
export interface CalendarEvent {
    readonly key: string
    readonly name: string
    readonly kind: string
    readonly lead_days: number
    readonly angle: string
    readonly fixed?: { readonly month: number; readonly day: number }
    readonly nth?: { readonly month: number; readonly weekday: number; readonly n: number }
    readonly dates?: Readonly<Record<string, string>>
}

/** Every known event. */
export const CALENDAR_EVENTS: ReadonlyArray<CalendarEvent> = calendarJson.events

/** An event placed on a date. */
export interface DatedEvent {
    readonly key: string
    readonly name: string
    readonly kind: string
    readonly date: string
    readonly lead_days: number
    readonly angle: string
}

/** Day (1..31) of the n-th given weekday (0 = Sunday) of a month. */
const nthWeekday = (y: number, m: number, weekday: number, n: number): number => {
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
    return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7
}

/** The date (yyyy-mm-dd) of an event in a year, or null (a lunar event whose date is not in the list). */
export const eventDate = (e: CalendarEvent, year: number): string | null => {
    if (e.fixed !== undefined) return `${year}-${pad2(e.fixed.month)}-${pad2(e.fixed.day)}`
    if (e.nth !== undefined) {
        return `${year}-${pad2(e.nth.month)}-${pad2(nthWeekday(year, e.nth.month, e.nth.weekday, e.nth.n))}`
    }
    return Object.entries(e.dates ?? {}).find(([name]) => name === String(year))?.[1] ?? null
}

const DAY_MS = 86_400_000

/**
 * Holidays and observances that matter to a month: events whose date falls inside the month, plus events within `lead_days`
 * after the month ends whose preparation posts belong to this month.
 */
export const eventsForMonth = (y: number, m: number): Array<DatedEvent> => {
    const start = Date.UTC(y, m - 1, 1)
    const end = Date.UTC(y, m, 0)
    const dated = CALENDAR_EVENTS.flatMap((e) =>
        [y, y + 1].flatMap((year) => {
            const date = eventDate(e, year)
            if (date === null) return []
            const t = Date.parse(`${date}T00:00:00Z`)
            const inMonth = t >= start && t <= end
            const prep = t > end && t - end <= Math.min(e.lead_days, 14) * DAY_MS
            return inMonth || prep
                ? [{ key: e.key, name: e.name, kind: e.kind, date, lead_days: e.lead_days, angle: e.angle }]
                : []
        }),
    )
    return dated.sort((a, b) => a.date.localeCompare(b.date))
}

/** One posting slot. */
export interface ContentSlot {
    readonly channel: ContentChannel
    readonly at: string
}

const DEFAULT_DAYS: ReadonlyArray<ReadonlyArray<number>> = [
    [3],
    [2, 5],
    [2, 4, 6],
    [1, 3, 5, 6],
    [1, 2, 4, 5, 6],
    [1, 2, 3, 4, 5, 6],
    [1, 2, 3, 4, 5, 6, 7],
]

const defaultDays = (perWeek: number): ReadonlyArray<number> => DEFAULT_DAYS[Math.min(7, Math.max(1, perWeek)) - 1]

/** The part of a cadence the slot calculation needs. */
export type CadenceLike = Pick<Cadence, "channel" | "posts_per_week" | "days" | "post_time">

/** The posting slots a cadence implies for a month (ISO instants, Vietnam time), skipping days before `from`. No weekdays chosen means spread evenly. */
export const slotsForMonth = (
    y: number,
    m: number,
    cadence: ReadonlyArray<CadenceLike>,
    from: Date = new Date(0),
): Array<ContentSlot> => {
    const dim = daysInMonth(y, m)
    const slots = cadence
        .filter((c) => c.posts_per_week > 0)
        .flatMap((c) => {
            const [hh, mm] = c.post_time.split(":").map(Number)
            const days = c.days.length > 0 ? c.days : defaultDays(c.posts_per_week)
            return Array.from({ length: dim }, (_, i) => i + 1)
                .filter((day) => days.includes(isoWeekdayOf(y, m, day)))
                .map((day) => ({ channel: c.channel, at: vnToIso(y, m, day, hh, mm) }))
                .filter((slot) => Date.parse(slot.at) >= from.getTime())
        })
    return slots.sort((a, b) => a.at.localeCompare(b.at))
}

/** One pillar's planned posts against the share its weight asks for. */
export interface BalanceRow {
    readonly pillarId: string | null
    readonly name: string
    readonly weight: number
    readonly count: number
    readonly targetShare: number
    readonly actualShare: number
}

/** Planned posts per pillar against the share each pillar's weight asks for. Skipped posts do not count. */
export const pillarBalance = (
    pillars: ReadonlyArray<Pillar>,
    items: ReadonlyArray<Pick<ContentItem, "pillar_id" | "status">>,
): Array<BalanceRow> => {
    const live = items.filter((i) => i.status !== "skipped")
    const active = pillars.filter((p) => p.active)
    const totalWeight = active.reduce((sum, p) => sum + p.weight, 0) || 1
    const share = (n: number): number => (live.length > 0 ? n / live.length : 0)
    const rows = active.map((p) => {
        const count = live.filter((i) => i.pillar_id === p.id).length
        return {
            pillarId: p.id,
            name: p.name,
            weight: p.weight,
            count,
            targetShare: p.weight / totalWeight,
            actualShare: share(count),
        }
    })
    const none = live.filter((i) => i.pillar_id === null || !active.some((p) => p.id === i.pillar_id)).length
    const rest =
        none > 0 ? [{ pillarId: null, name: "", weight: 0, count: none, targetShare: 0, actualShare: share(none) }] : []
    return [...rows, ...rest]
}
