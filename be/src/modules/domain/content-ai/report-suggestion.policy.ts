import { isRecord, parseJsonText } from "@modules/platform/primitives"
import type { Locale } from "@modules/platform/i18n"
import type { WeeklySource } from "@modules/domain/content-weekly-reports"
import type { GuidelineKit, MarketingWeeklyReport, SuggestionText } from "./content-agent.contracts"

const textOf = (value: unknown, max: number): string => (typeof value === "string" ? value.trim().slice(0, max) : "")

/** The numbers of the week as the model reads them: totals, the change, engagements per day and the top posts. */
const factsOf = (report: MarketingWeeklyReport): string =>
    JSON.stringify({
        week: { start: report.weekStart, end: report.weekEnd },
        channels: report.channels,
        reach: report.reach,
        engagements: report.engagements,
        messages: report.messages,
        engagementsPerDay: report.days.map((day) => ({ day: day.day, byChannel: day.byChannel })),
        postsPublished: report.postCount,
        topPosts: report.posts.map((post) => ({
            title: post.title,
            channel: post.channel,
            publishedAt: post.publishedAt,
            engagements: post.engagements,
        })),
    })

/** The brand facts the prompt carries, so the advice stays in the confirmed tone. */
const brandLine = (kit: GuidelineKit | null): string =>
    kit === null ? "No brand kit is confirmed yet." : `Brand: ${kit.brandName}. Tone: ${kit.tone}`

/**
 * The prompt that reads one week of marketing numbers and answers ONE suggestion for the next week, grounded only in the
 * numbers given (the model must not invent a figure the week does not hold).
 */
export const suggestionMessages = (
    report: MarketingWeeklyReport,
    kit: GuidelineKit | null,
    locale: Locale,
): ReadonlyArray<{ readonly role: "system" | "user"; readonly content: string }> => [
    {
        role: "system",
        content: [
            "You are the marketing agent of the business below. Read the numbers of last week and give ONE suggestion for next week.",
            'Answer ONE JSON object: {"title": string, "body": string}.',
            "title: at most 12 words, what worked best, with its number (for example the channel, day or post that led).",
            "body: at most 3 short sentences: the evidence from the numbers, then one concrete step for next week.",
            "Use only the numbers given; never invent a figure, an offer or a date.",
            `Write in ${locale === "vi" ? "Vietnamese" : "English"}.`,
            brandLine(kit),
        ].join("\n"),
    },
    { role: "user", content: factsOf(report) },
]

/** The suggestion the model answered, or null when it has no title or no body. */
export const readSuggestion = (raw: string): SuggestionText | null => {
    const read = parseJsonText(raw)
    if (!read.ok || !isRecord(read.value)) return null
    const title = textOf(read.value.title, 120)
    const body = textOf(read.value.body, 600)
    return title === "" || body === "" ? null : { title, body }
}

/** The channels whose posts the report ranked, each once. */
const postChannels = (report: MarketingWeeklyReport): ReadonlySet<string> =>
    new Set(report.posts.map((post) => post.channel))

/**
 * The sources the suggestion stands on, in the order the model was given them: the Page insights (layer 1) when Facebook reported,
 * the customer messages of the channels, the published posts of each channel it ranked, and the brand kit (layer 2).
 */
export const suggestionSourcesOf = (
    report: MarketingWeeklyReport,
    kit: GuidelineKit | null,
): ReadonlyArray<WeeklySource> => {
    const ranked = postChannels(report)
    return [
        ...(report.channels.includes("facebook")
            ? [{ layer: 1, kind: "connector", ref: "meta.page_insights", label: "facebook" }]
            : []),
        ...(report.messages.value === 0
            ? []
            : [{ layer: 1, kind: "connector", ref: "channel.messages", label: report.channels.join(", ") }]),
        ...(ranked.has("facebook")
            ? [{ layer: 1, kind: "connector", ref: "meta.published_posts", label: "facebook" }]
            : []),
        ...(ranked.has("zalo") ? [{ layer: 1, kind: "connector", ref: "zalo.articles", label: "zalo" }] : []),
        ...(kit === null
            ? []
            : [{ layer: 2, kind: "brain_fact", ref: `brand_kit:${kit.brandName}`, label: kit.brandName }]),
    ]
}
