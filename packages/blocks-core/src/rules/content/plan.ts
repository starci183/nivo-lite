import type { BrandChannelCadence, BrandPillar } from "./brand"
import { OCCASIONS, type Occasion } from "./calendar"
import { addDays, dayNumberOf, isoWeekdayOf, monthEndOf } from "./day"
import type { ContentChannel } from "./post"

/** The weekdays a channel posts on when its rhythm names none, by posts a week (1 to 7). */
const DEFAULT_DAYS: ReadonlyArray<ReadonlyArray<number>> = [
    [3],
    [2, 5],
    [2, 4, 6],
    [1, 3, 5, 6],
    [1, 2, 4, 5, 6],
    [1, 2, 3, 4, 5, 6],
    [1, 2, 3, 4, 5, 6, 7],
]

/** The most days ahead of an occasion a post prepares it, whatever the occasion asks. */
const PIN_LEAD_MAX = 7

/** The days after an occasion a post may still be pinned to it. */
const PIN_AFTER = 2

/** The most days ahead of next month's occasion this month's plan already looks. */
const PEEK_LEAD_MAX = 14

/** An occasion that falls on one day. */
export type PlanOccasion = {
    /** The stable key. */
    readonly key: string
    /** The calendar day, `YYYY-MM-DD`; null when none. */
    readonly day: string
    /** Its name. */
    readonly name: string
    /** The angle a post may take; never an offer. */
    readonly angle: string
    /** How many days ahead posts prepare it. */
    readonly leadDays: number
}

/** One moment of the plan: its number, the day and wall-clock time, and the channels that post then. */
export type PlanMoment = {
    /** The rank of the weekday in the month, or the number of the moment in the plan. */
    readonly n: number
    /** The calendar day, `YYYY-MM-DD`; null when none. */
    readonly day: string
    /** The wall-clock time on the shop's clock, `HH:MM`; empty when none. */
    readonly time: string
    /** The channels that post at that moment. */
    readonly channels: ReadonlyArray<ContentChannel>
}

/** A moment with the theme it is written on and the occasion pinned to it. */
export type PlannedSlot = PlanMoment & {
    /** The theme the post is written on. */
    readonly pillar: BrandPillar
    /** The occasion pinned to the moment; null when none. */
    readonly occasion: PlanOccasion | null
}

/** A theme's share of the posts. */
export type PillarShare = {
    /** The theme the post is written on. */
    readonly pillar: BrandPillar
    /** How many posts it takes. */
    readonly count: number
}

/** The plan of the rest of a month: its moments with their themes and occasions, the occasions and each theme's share. */
export type PlannedMonth = {
    /** The moments of the plan with their themes and occasions. */
    readonly slots: ReadonlyArray<PlannedSlot>
    /** The occasions of the month. */
    readonly occasions: ReadonlyArray<PlanOccasion>
    /** Each theme's share of the posts. */
    readonly quota: ReadonlyArray<PillarShare>
}

/** One channel posting on one day at one time. */
type ChannelMoment = { readonly channel: ContentChannel; readonly day: string; readonly time: string }

const pad2 = (value: number): string => String(value).padStart(2, "0")

/** The day an occasion falls on in a year, or null when the calendar does not hold that year. */
const occasionDay = (occasion: Occasion, year: number): string | null => {
    if ("fixed" in occasion) return `${year}-${pad2(occasion.fixed.month)}-${pad2(occasion.fixed.day)}`
    if ("nth" in occasion) {
        const first = new Date(Date.UTC(year, occasion.nth.month - 1, 1)).getUTCDay()
        const day = 1 + ((occasion.nth.weekday - first + 7) % 7) + (occasion.nth.n - 1) * 7
        return `${year}-${pad2(occasion.nth.month)}-${pad2(day)}`
    }
    return occasion.dates[String(year)] ?? null
}

/** The occasions of the month of `day`, and those of the next month whose preparation (at most two weeks) reaches into it. */
export const occasionsOfMonth = (day: string): ReadonlyArray<PlanOccasion> => {
    const year = Number(day.slice(0, 4))
    const start = dayNumberOf(`${day.slice(0, 7)}-01`)
    const end = dayNumberOf(monthEndOf(day))
    return OCCASIONS.flatMap((occasion) =>
        [year, year + 1].flatMap((each) => {
            const on = occasionDay(occasion, each)
            if (on === null) return []
            const at = dayNumberOf(on)
            const within = at >= start && at <= end
            const ahead = at > end && at - end <= Math.min(occasion.leadDays, PEEK_LEAD_MAX)
            return within || ahead
                ? [{ key: occasion.key, day: on, name: occasion.name, angle: occasion.angle, leadDays: occasion.leadDays }]
                : []
        }),
    ).sort((a, b) => a.day.localeCompare(b.day))
}

/** The moments each channel posts from `fromDay` to the end of its month, by its rhythm, in order. */
export const channelMomentsOf = (
    fromDay: string,
    cadence: ReadonlyArray<BrandChannelCadence>,
): ReadonlyArray<ChannelMoment> => {
    const count = dayNumberOf(monthEndOf(fromDay)) - dayNumberOf(fromDay) + 1
    const days = Array.from({ length: Math.max(0, count) }, (_, index) => addDays(fromDay, index))
    return cadence
        .filter((rhythm) => rhythm.postsPerWeek > 0)
        .flatMap((rhythm) => {
            const weekdays =
                rhythm.days.length > 0 ? rhythm.days : (DEFAULT_DAYS[Math.min(7, rhythm.postsPerWeek) - 1] ?? [3])
            return days
                .filter((day) => weekdays.includes(isoWeekdayOf(day)))
                .map((day) => ({ channel: rhythm.channel, day, time: rhythm.time }))
        })
        .sort((a, b) => `${a.day} ${a.time}`.localeCompare(`${b.day} ${b.time}`))
}

/** The moments of the plan: the channels that post on the same day at the same time share one idea, numbered in order. */
export const momentsOf = (moments: ReadonlyArray<ChannelMoment>): ReadonlyArray<PlanMoment> => {
    const grouped = new Map<string, Array<ContentChannel>>()
    for (const moment of moments) {
        const at = `${moment.day} ${moment.time}`
        grouped.set(at, [...(grouped.get(at) ?? []), moment.channel])
    }
    return [...grouped.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([at, channels], index) => ({ n: index + 1, day: at.slice(0, 10), time: at.slice(11), channels }))
}

/** Each active theme's whole share of `total` posts, by weight, the remainders given to the largest fractions. */
export const pillarQuota = (pillars: ReadonlyArray<BrandPillar>, total: number): ReadonlyArray<PillarShare> => {
    const active = pillars.filter((pillar) => pillar.active && pillar.weight > 0)
    const sum = active.reduce((all, pillar) => all + pillar.weight, 0)
    if (active.length === 0 || total <= 0) return []
    const rows = active.map((pillar, index) => {
        const exact = (pillar.weight / sum) * total
        return { pillar, index, count: Math.floor(exact), rest: exact - Math.floor(exact) }
    })
    const left = total - rows.reduce((all, row) => all + row.count, 0)
    const bumped = new Set(
        [...rows]
            .sort((a, b) => b.rest - a.rest || a.index - b.index)
            .slice(0, Math.max(0, left))
            .map((row) => row.index),
    )
    return rows.map((row) => ({ pillar: row.pillar, count: bumped.has(row.index) ? row.count + 1 : row.count }))
}

/** The theme of each post in order, never the same theme twice in a row while another still has posts left. */
export const themeSequence = (quota: ReadonlyArray<PillarShare>, total: number): ReadonlyArray<BrandPillar> => {
    const left = quota.map((share) => ({ pillar: share.pillar, n: share.count }))
    const out: Array<BrandPillar> = []
    for (let index = 0; index < total; index += 1) {
        const previous = out.at(-1)
        const candidates = left.filter((entry) => entry.n > 0).sort((a, b) => b.n - a.n)
        const pick = candidates.find((entry) => entry.pillar !== previous) ?? candidates[0]
        if (pick === undefined) break
        pick.n -= 1
        out.push(pick.pillar)
    }
    return out
}

/** Each occasion pinned to the last free moment of its preparation days (at most a week), else the first free one just after it. */
export const pinOccasions = (
    moments: ReadonlyArray<PlanMoment>,
    occasions: ReadonlyArray<PlanOccasion>,
): ReadonlyMap<number, PlanOccasion> => {
    const pinned = new Map<number, PlanOccasion>()
    for (const occasion of occasions) {
        const on = dayNumberOf(occasion.day)
        const free = moments.filter((moment) => !pinned.has(moment.n))
        const before = free.filter((moment) => {
            const at = dayNumberOf(moment.day)
            return at <= on && at >= on - Math.min(occasion.leadDays, PIN_LEAD_MAX)
        })
        const after = free.find((moment) => {
            const at = dayNumberOf(moment.day)
            return at > on && at <= on + PIN_AFTER
        })
        const pick = before.at(-1) ?? after
        if (pick !== undefined) pinned.set(pick.n, occasion)
    }
    return pinned
}

/**
 * The plan of the rest of the month from `fromDay` (a calendar day of the shop): code settles each moment, its channels, its theme and
 * the occasion pinned to it, so the model only writes the ideas. A brand with no rhythm or no active theme plans nothing.
 */
export const planMonth = (
    fromDay: string,
    cadence: ReadonlyArray<BrandChannelCadence>,
    pillars: ReadonlyArray<BrandPillar>,
): PlannedMonth => {
    const moments = momentsOf(channelMomentsOf(fromDay, cadence))
    const occasions = occasionsOfMonth(fromDay)
    const quota = pillarQuota(pillars, moments.length)
    const themes = themeSequence(quota, moments.length)
    const pinned = pinOccasions(moments, occasions)
    return {
        slots: moments.flatMap((moment) => {
            const pillar = themes[moment.n - 1]
            return pillar === undefined ? [] : [{ ...moment, pillar, occasion: pinned.get(moment.n) ?? null }]
        }),
        occasions,
        quota,
    }
}

/** A theme as the prompt names it: its name, with what it covers when it says. */
const themeOf = (pillar: BrandPillar): string =>
    pillar.description === "" ? pillar.name : `${pillar.name} (${pillar.description})`

/** One line of the plan prompt: the moment, its channels, its theme and its occasion. */
export const slotLineOf = (slot: PlannedSlot): string =>
    [
        `Slot ${slot.n}: ${slot.day} ${slot.time}`,
        `channels: ${slot.channels.join(", ")}`,
        `theme: ${themeOf(slot.pillar)}`,
        slot.occasion === null ? "" : `occasion: ${slot.occasion.name} on ${slot.occasion.day}: ${slot.occasion.angle}`,
    ]
        .filter((part) => part !== "")
        .join("; ")
