import type { WeeklyPost } from "@modules/domain/content-weekly-reports"
import type {
    BestDay,
    EngagementDay,
    MarketingWeeklyReport,
    PublishedPost,
    ReportMetric,
    WeekBounds,
} from "./content-agent.contracts"

const DAY_MS = 86_400_000
/** Vietnam is UTC+7 all year. */
const VN_OFFSET_MS = 7 * 3_600_000
/** How many posts the report ranks. */
const TOP_POSTS = 4

const dayText = (time: number): string => new Date(time).toISOString().slice(0, 10)

/** The Monday (Vietnam time) of the last complete week before `now`, as `YYYY-MM-DD`. */
export const lastWeekStart = (now: Date): string => {
    const local = new Date(now.getTime() + VN_OFFSET_MS)
    const today = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
    const sinceMonday = (local.getUTCDay() + 6) % 7
    return dayText(today - (sinceMonday + 7) * DAY_MS)
}

/** The days of the week that starts on `weekStart`, Monday first. */
export const weekDays = (weekStart: string): ReadonlyArray<string> => {
    const start = Date.parse(`${weekStart}T00:00:00.000Z`)
    return Array.from({ length: 7 }, (_, index) => dayText(start + index * DAY_MS))
}

/** The first day after the week, `YYYY-MM-DD`, and the first day of the week before. */
export const weekBounds = (weekStart: string): WeekBounds => {
    const start = Date.parse(`${weekStart}T00:00:00.000Z`)
    return { previousStart: dayText(start - 7 * DAY_MS), nextStart: dayText(start + 7 * DAY_MS) }
}

const metricOf = (value: number, previous: number): ReportMetric => ({
    value,
    previous,
    changePct: previous === 0 ? null : Math.round(((value - previous) / previous) * 100),
})

const sum = (rows: ReadonlyArray<EngagementDay>, pick: (row: EngagementDay) => number): number =>
    rows.reduce((total, row) => total + pick(row), 0)

/** The first line of a post text, cut to a title. */
const titleOf = (message: string): string => message.trim().split("\n", 1).join("").trim().slice(0, 120)

/** The Vietnam day of an ISO moment, or an empty text when it is not a moment. */
const vnDayOf = (iso: string): string => {
    const at = Date.parse(iso)
    return Number.isFinite(at) ? dayText(at + VN_OFFSET_MS) : ""
}

/** The posts published on `days` (Vietnam time), most engagements first, then the newest. */
const weekPostsOf = (days: ReadonlyArray<string>, posts: ReadonlyArray<PublishedPost>): Array<WeeklyPost> =>
    posts
        .filter((post) => days.includes(vnDayOf(post.publishedAt)))
        .map((post) => ({
            id: post.id,
            channel: post.channel,
            title: titleOf(post.message),
            publishedAt: post.publishedAt,
            engagements: post.engagements,
            href: post.href,
        }))
        .sort((a, b) => b.engagements - a.engagements || b.publishedAt.localeCompare(a.publishedAt))

/**
 * The report of the week starting `weekStart` from the daily rows of that week and the week before (other rows are ignored)
 * and the posts the channels published (posts outside the week are ignored). The suggestion is the model's, added later.
 */
export const weeklyReportOf = (
    weekStart: string,
    rows: ReadonlyArray<EngagementDay>,
    posts: ReadonlyArray<PublishedPost>,
): MarketingWeeklyReport => {
    const days = weekDays(weekStart)
    const published = weekPostsOf(days, posts)
    const previousDays = new Set(weekDays(weekBounds(weekStart).previousStart))
    const current = rows.filter((row) => days.includes(row.day))
    const previous = rows.filter((row) => previousDays.has(row.day))
    const channels = [...new Set(current.map((row) => row.channel))].sort((a, b) => a.localeCompare(b))
    return {
        weekStart,
        weekEnd: dayText(Date.parse(`${weekStart}T00:00:00.000Z`) + 6 * DAY_MS),
        reach: metricOf(
            sum(current, (row) => row.reach),
            sum(previous, (row) => row.reach),
        ),
        engagements: metricOf(
            sum(current, (row) => row.engagements),
            sum(previous, (row) => row.engagements),
        ),
        messages: metricOf(
            sum(current, (row) => row.messages),
            sum(previous, (row) => row.messages),
        ),
        days: days.map((day) => {
            const values = channels.map((channel) => ({
                channel,
                value: sum(
                    current.filter((row) => row.day === day && row.channel === channel),
                    (row) => row.engagements,
                ),
            }))
            return {
                day,
                byChannel: Object.fromEntries(values.map((entry) => [entry.channel, entry.value])),
                channels: values,
            }
        }),
        channels,
        posts: published.slice(0, TOP_POSTS),
        postCount: published.length,
        suggestion: null,
    }
}

/** The channel and day of the week's best engagement, or null when nothing engaged. */
export const bestDayOf = (report: MarketingWeeklyReport): BestDay | null => {
    let best: BestDay | null = null
    let bestValue = 0
    for (const day of report.days) {
        for (const [channel, value] of Object.entries(day.byChannel)) {
            if (value > bestValue) {
                best = { day: day.day, channel }
                bestValue = value
            }
        }
    }
    return best
}

/** How long the extras of a week that is not over yet stay fresh. */
const FRESH_MS = 3_600_000
/** The Vietnam hour of Monday from which the weekly report of the week before is posted. */
const POST_HOUR = 8

/** The instant a Vietnam day starts. */
const vnMidnightOf = (day: string): number => Date.parse(`${day}T00:00:00.000Z`) - VN_OFFSET_MS

/**
 * True when stored extras can be shown as they are: they were computed after the week ended (its figures are final), or less
 * than an hour ago for a week that is still running. Extras never computed are not fresh.
 */
export const isCacheFresh = (computedAt: string | null, nextStart: string, now: Date): boolean => {
    if (computedAt === null) return false
    const at = Date.parse(computedAt)
    return at >= vnMidnightOf(nextStart) || now.getTime() - at < FRESH_MS
}

/** True from Monday 08:00 (Vietnam time) on: the weekly report of the week before may be posted. */
export const isWeeklyPostDue = (now: Date): boolean =>
    now.getTime() >= vnMidnightOf(weekBounds(lastWeekStart(now)).nextStart) + POST_HOUR * 3_600_000
