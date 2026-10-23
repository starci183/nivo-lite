import { CHANNEL_RULES } from "./content.templates"
import { daysInMonth, isoWeekdayOf, vnToIso } from "./time"
import type { Cadence, ChannelRule, ContentChannel, ContentItem, Pillar } from "./types"

/** The rule of one channel (the first channel when none matches). */
export const channelRule = (channel: ContentChannel): ChannelRule =>
    CHANNEL_RULES.find((rule) => rule.key === channel) ?? CHANNEL_RULES[0]

/** An event placed on a date. */
export interface DatedEvent {
    readonly key: string
    readonly name: string
    readonly kind: string
    readonly date: string
    readonly lead_days: number
    readonly angle: string
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

const defaultDays = (perWeek: number): ReadonlyArray<number> =>
    DEFAULT_DAYS[Math.min(7, Math.max(1, perWeek)) - 1] ?? []

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
