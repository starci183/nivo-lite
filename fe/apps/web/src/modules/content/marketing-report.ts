import type { WeeklyReportType } from "@/modules/api"

/** The weekly report as the Performance tab draws it. */
export interface MarketingReportView {
    readonly period: string
    readonly kpis: ReadonlyArray<{
        readonly id: string
        readonly term: string
        readonly description: string
        readonly meta: string
    }>
    /** One row per day: its total engagements and the share of each channel. */
    readonly days: ReadonlyArray<{
        readonly id: string
        readonly label: string
        readonly total: number
        readonly breakdown: string
    }>
    readonly dayMax: number
    readonly channels: ReadonlyArray<{ readonly id: string; readonly term: string; readonly description: string }>
    /** What the numbers say, read from the week itself: the strongest channel and day; empty for a week without engagement. */
    readonly insight: string
    /** The most engaging posts of the week: the title, where and when, and the engagements. */
    readonly posts: ReadonlyArray<{ readonly id: string; readonly term: string; readonly description: string }>
    /** How many of the week's published posts the list shows; empty without posts. */
    readonly postsNote: string
    /** The AI Marketing suggestion for the next week and the sources it read; null when there is none. */
    readonly suggestion: {
        readonly title: string
        readonly body: string
        readonly sources: string
    } | null
}

/** The words and formats the projection needs, resolved by the caller (the marketing catalog and the locale formatter). */
export interface MarketingReportSay {
    readonly number: (value: number) => string
    readonly day: (iso: string) => string
    readonly period: (startIso: string, endIso: string) => string
    readonly channel: (channel: string) => string
    readonly change: (changePct: number | null) => string
    readonly kpi: { readonly reach: string; readonly engagements: string; readonly messages: string }
    readonly insight: (channel: string, share: number, day: string, count: string) => string
    readonly post: (title: string, channel: string, publishedAt: string) => string
    readonly engagements: (count: string) => string
    readonly postsNote: (shown: number, count: number) => string
    readonly source: (ref: string, label: string) => string
    readonly sources: (list: string) => string
}

const sum = (values: ReadonlyArray<number>) => values.reduce((total, value) => total + value, 0)

const strongest = <T extends { readonly total: number }>(rows: ReadonlyArray<T>): T | undefined =>
    rows.reduce<T | undefined>((best, row) => (best === undefined || row.total > best.total ? row : best), undefined)

const channelTotal = (report: WeeklyReportType, channel: string) =>
    sum(
        report.days.flatMap((day) =>
            day.channels.filter((entry) => entry.channel === channel).map((entry) => entry.value),
        ),
    )

/** The suggestion with its sources worded, or null. */
const suggestionOf = (say: MarketingReportSay, report: WeeklyReportType): MarketingReportView["suggestion"] => {
    const suggestion = report.suggestion
    if (!suggestion) return null
    const sources = suggestion.sources.map((source) => say.source(source.ref, source.label)).join(" · ")
    return { title: suggestion.title, body: suggestion.body, sources: say.sources(sources) }
}

/**
 * Projects the weekly report into the key figures, the engagement chart, the channel totals, the reading of the week, the top
 * posts and the AI suggestion.
 */
export const marketingReportView = (say: MarketingReportSay, report: WeeklyReportType): MarketingReportView => {
    const days = report.days.map((day) => ({
        id: day.day,
        label: say.day(day.day),
        total: sum(day.channels.map((entry) => entry.value)),
        breakdown: day.channels.map((entry) => `${say.channel(entry.channel)} ${say.number(entry.value)}`).join(" · "),
    }))
    const channels = report.channels.map((channel) => ({
        id: channel,
        term: say.channel(channel),
        total: channelTotal(report, channel),
    }))
    const bestChannel = strongest(channels)
    const bestDay = strongest(days)
    const total = sum(days.map((day) => day.total))
    const metric = (id: keyof MarketingReportSay["kpi"]) => ({
        id,
        term: say.kpi[id],
        description: say.number(report[id].value),
        meta: say.change(report[id].changePct ?? null),
    })
    return {
        period: say.period(report.weekStart, report.weekEnd),
        kpis: [metric("reach"), metric("engagements"), metric("messages")],
        days,
        dayMax: Math.max(1, ...days.map((day) => day.total)),
        channels: channels.map((channel) => ({
            id: channel.id,
            term: channel.term,
            description: say.number(channel.total),
        })),
        insight:
            total === 0 || bestChannel === undefined || bestDay === undefined
                ? ""
                : say.insight(
                      bestChannel.term,
                      Math.round((bestChannel.total / total) * 100),
                      bestDay.label,
                      say.number(bestDay.total),
                  ),
        posts: report.posts.map((post) => ({
            id: post.id,
            term: say.post(post.title, say.channel(post.channel), post.publishedAt),
            description: say.engagements(say.number(post.engagements)),
        })),
        postsNote: report.postCount === 0 ? "" : say.postsNote(report.posts.length, report.postCount),
        suggestion: suggestionOf(say, report),
    }
}

/** The shape the tab keeps while the report loads (STATE-8: the same tree draws as a skeleton). */
export const MARKETING_REPORT_PLACEHOLDER: MarketingReportView = {
    period: "",
    kpis: ["reach", "engagements", "messages"].map((id) => ({ id, term: id, description: "", meta: "" })),
    days: ["1", "2", "3", "4", "5", "6", "7"].map((id) => ({ id, label: "", total: 0, breakdown: "" })),
    dayMax: 1,
    channels: [],
    insight: "",
    posts: [],
    postsNote: "",
    suggestion: null,
}
