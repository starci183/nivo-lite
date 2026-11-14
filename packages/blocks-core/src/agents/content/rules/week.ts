import { addDays, weekStartOf } from "./day"
import type { ContentChannel, ContentStatus } from "./post"

/** A week, Monday to Sunday, as calendar days of the shop. */
export type Week = {
    /** The first day, `YYYY-MM-DD`. */
    readonly from: string
    /** The last day, `YYYY-MM-DD`. */
    readonly to: string
}

/** What the weekly report reads of one post. */
export type WeekPost = {
    /** Where the post stands. */
    readonly status: ContentStatus
    /** The social channel. */
    readonly channel: ContentChannel
    /** The calendar day, `YYYY-MM-DD`; null when none. */
    readonly day: string | null
}

/** The posts of a week: how many were planned for it, and where they stand. */
export type WeekSummary = Week & {
    /** The posts planned for the week. */
    readonly planned: number
    /** The posts of the week still drafts. */
    readonly drafts: number
    /** The posts of the week approved and waiting to be published. */
    readonly approved: number
    /** The posts of the week published. */
    readonly published: number
    /** The posts of the week by channel. */
    readonly byChannel: Readonly<Record<ContentChannel, number>>
}

/** The last whole week before the week of `day`. */
export const lastWeekOf = (day: string): Week => {
    const monday = addDays(weekStartOf(day), -7)
    return { from: monday, to: addDays(monday, 6) }
}

/** The summary of the posts planned for a week; a post of another day, or of no day, is not counted. */
export const weekSummaryOf = (week: Week, posts: ReadonlyArray<WeekPost>): WeekSummary => {
    const within = posts.filter((post) => post.day !== null && post.day >= week.from && post.day <= week.to)
    const count = (status: ContentStatus): number => within.filter((post) => post.status === status).length
    const on = (channel: ContentChannel): number => within.filter((post) => post.channel === channel).length
    return {
        ...week,
        planned: within.length,
        drafts: count("draft"),
        approved: count("approved"),
        published: count("published"),
        byChannel: { facebook: on("facebook"), zalo: on("zalo"), tiktok: on("tiktok"), instagram: on("instagram") },
    }
}

/** A message template with `{name}` places filled from the values; a place with no value stays as written. */
export const fillTemplate = (template: string, values: Readonly<Record<string, string | number>>): string =>
    template.replaceAll(/\{(\w+)\}/gu, (whole: string, name: string) => {
        const value = values[name]
        return value === undefined ? whole : String(value)
    })
