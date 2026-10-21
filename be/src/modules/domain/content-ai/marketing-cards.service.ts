import { Injectable } from "@nestjs/common"
import { OfficeCardsService, OfficeLinesService } from "@modules/domain/messages"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import type { WeeklyPost, WeeklySource } from "@modules/domain/content-weekly-reports"
import { BrandImagesService } from "./brand-images.service"
import type { ReportMetric } from "./content-agent.contracts"
import type {
    ApprovalRequestCard,
    CardSource,
    DraftPostCard,
    MarketingCard,
    ScheduleConfirmedCard,
    WeeklyReportCard,
} from "./marketing-cards.contracts"

/** The department whose agent speaks the cards. */
const DEPARTMENT = "content"

/** The Hub room the cards go to. */
const ROOM = "marketing"

/** Vietnam is UTC+7 all year. */
const VN_OFFSET_MS = 7 * 3_600_000

/** What the Hub accepts as a media url or link: https or app-relative. */
const HREF = /^(https:\/\/|\/(?!\/))/

/** The record kind of a source by its data layer, when the marketing source does not name one. */
const KIND_BY_LAYER: ReadonlyMap<number, string> = new Map([
    [1, "mcp_tool"],
    [2, "brain_document"],
    [3, "brain_lesson"],
    [4, "base_document"],
])

/** The words a card draws, each the catalog entry `marketing.word.<name>` of the card's language. */
interface Words {
    /** The badge of a decision waiting for the owner. */
    readonly approval: string
    /** The prefix of a brand kit source. */
    readonly brandKit: string
    /** The label of the channels row. */
    readonly channels: string
    /** The label of the engagements figure. */
    readonly engagements: string
    /** The label of the media library source. */
    readonly mediaLibrary: string
    /** The label of the new messages figure. */
    readonly messages: string
    /** The badge of a post no channel took. */
    readonly notScheduled: string
    /** The label of the owner's request source. */
    readonly ownerRequest: string
    /** The label of the Page insights source. */
    readonly pageInsights: string
    /** The label of the publish time row. */
    readonly publishAt: string
    /** The label of the published posts source. */
    readonly publishedPosts: string
    /** The label of the customer messages source. */
    readonly customerMessages: string
    /** The label of the Zalo OA articles source. */
    readonly zaloArticles: string
    /** The label of the reach figure. */
    readonly reach: string
    /** The title of the weekly report. */
    readonly report: string
    /** The badge of a scheduled post. */
    readonly scheduled: string
    /** One catalog entry of the card's language with its values filled. */
    readonly say: (key: string, params: Readonly<Record<string, string>>) => string
}

/** A text cut to the Hub limit, with a fallback when it would be empty. */
const clip = (text: string, max: number, fallback = "-"): string => {
    const trimmed = text.trim()
    return (trimmed === "" ? fallback : trimmed).slice(0, max)
}

/** An ISO moment as Vietnam wall time, `HH:mm dd/MM/yyyy`; the text itself when it is not a moment. */
const vnTime = (iso: string): string => {
    const at = Date.parse(iso)
    if (!Number.isFinite(at)) return iso
    const local = new Date(at + VN_OFFSET_MS)
    const two = (value: number): string => String(value).padStart(2, "0")
    const day = `${two(local.getUTCDate())}/${two(local.getUTCMonth() + 1)}/${local.getUTCFullYear()}`
    return `${two(local.getUTCHours())}:${two(local.getUTCMinutes())} ${day}`
}

/** Where a card goes: the workspace and the language of its text line. */
export interface CardScope {
    /** The workspace. */
    readonly workspaceId: string
    /** The language of the line. */
    readonly locale: Locale
}

/** The Hub card payload (v1) as this adapter builds it; `OfficeCardsService` validates it before storing. */
type HubCard = Readonly<Record<string, unknown>>

/** How a marketing source label reads on the card. */
const labelOf = (words: Words, label: string): string => {
    if (label.startsWith("brand_kit:")) return `${words.brandKit}: ${label.slice("brand_kit:".length)}`
    if (label === "media_library") return words.mediaLibrary
    if (label === "owner_request") return words.ownerRequest
    if (label === "meta.page_insights") return words.pageInsights
    if (label === "meta.published_posts") return words.publishedPosts
    if (label === "channel.messages") return words.customerMessages
    if (label === "zalo.articles") return words.zaloArticles
    return label
}

/** The sources a draft used, in the Hub's single source shape; layers outside 1..4 and "no brand kit" are left out. */
const sourcesOf = (words: Words, sources: ReadonlyArray<CardSource>): Array<Readonly<Record<string, unknown>>> =>
    sources
        .flatMap((source) => {
            const kind = KIND_BY_LAYER.get(source.layer)
            if (kind === undefined || source.label === "brand_kit:none") return []
            return [
                {
                    layer: source.layer,
                    kind,
                    ref: clip(source.ref, 200),
                    label: clip(labelOf(words, source.label), 160),
                },
            ]
        })
        .slice(0, 10)

/** The publish_post decision card: its work item is the ref the buttons decide. */
const approvalCard = (words: Words, card: ApprovalRequestCard): HubCard => ({
    v: 1,
    type: "approval_request",
    title: clip(card.title, 160),
    badge: words.approval.slice(0, 40),
    fields: [
        { label: words.channels, value: clip(card.channels.join(" + "), 400) },
        { label: words.publishAt, value: clip(vnTime(card.scheduledAt), 400) },
    ],
    ...(card.workItemId === null
        ? {}
        : { ref: { kind: "work_item", id: card.workItemId }, actions: ["approve", "decline"] }),
    data: { content_item_id: card.contentItemId },
})

/** The scheduled post card, one row per channel that accepted it, the refusals as its text. */
const scheduledCard = (words: Words, card: ScheduleConfirmedCard): HubCard => {
    const failed = card.failed.map((entry) => `${entry.channel}: ${entry.reason}`).join("\n")
    const fields = card.channels
        .slice(0, 12)
        .map((entry) => ({ label: clip(entry.channel, 80), value: clip(vnTime(card.scheduledAt), 400) }))
    return {
        v: 1,
        type: "schedule_confirmed",
        title: clip(card.title, 160),
        badge: (card.channels.length === 0 ? words.notScheduled : words.scheduled).slice(0, 40),
        ...(failed === "" ? {} : { body: failed.slice(0, 4000) }),
        ...(fields.length === 0 ? {} : { fields }),
        data: { content_item_id: card.contentItemId },
    }
}

/** One top post of the week as a card line: its Vietnam day and its title with the engagements. */
const postLineOf = (words: Words, numbers: Intl.NumberFormat, post: WeeklyPost): Readonly<Record<string, string>> => ({
    at: vnTime(post.publishedAt).slice(6, 11),
    text: clip(
        words.say("marketing.word.postLine", { title: post.title, count: numbers.format(post.engagements) }),
        400,
    ),
})

/** The suggestion's sources in the Hub's single source shape, worded on the card. */
const reportSourcesOf = (
    words: Words,
    sources: ReadonlyArray<WeeklySource>,
): Array<Readonly<Record<string, unknown>>> =>
    sources.slice(0, 10).map((source) => ({
        layer: source.layer,
        kind: clip(source.kind, 40),
        ref: clip(source.ref, 200),
        label: clip(labelOf(words, source.ref), 160),
    }))

/** A percentage change with its sign: `+12%`, `+0%`, `-3%`. */
const signedPct = (pct: number): string => (pct >= 0 ? `+${pct}%` : `${pct}%`)

/** The weekly report card: the key figures, the top posts as lines, the suggestion as its text; the chart reads `data`. */
const reportCard = (locale: Locale, words: Words, card: WeeklyReportCard): HubCard => {
    const numbers = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US")
    const metric = (label: string, value: ReportMetric): Readonly<Record<string, string>> => {
        const change = value.changePct === null ? "" : ` (${signedPct(value.changePct)})`
        return { label, value: clip(`${numbers.format(value.value)}${change}`, 400) }
    }
    const { report } = card
    const suggestion = report.suggestion
    return {
        v: 1,
        type: "weekly_report",
        title: words.report,
        subtitle: clip(words.say("marketing.word.period", { from: report.weekStart, to: report.weekEnd }), 240),
        ...(suggestion === null ? {} : { body: [suggestion.title, suggestion.body].join("\n\n").slice(0, 4000) }),
        fields: [
            metric(words.reach, report.reach),
            metric(words.engagements, report.engagements),
            metric(words.messages, report.messages),
        ],
        ...(report.posts.length === 0 ? {} : { lines: report.posts.map((post) => postLineOf(words, numbers, post)) }),
        ...(suggestion === null || suggestion.sources.length === 0
            ? {}
            : { sources: reportSourcesOf(words, suggestion.sources) }),
        data: { ...report },
    }
}

@Injectable()
/**
 * The adapter between the AI Marketing flow and the Hub: a card is posted as a Hub result card (v1) of the AI
 * Marketing agent in the Marketing room, with the text line that summarises it as its preview.
 */
export class MarketingCardsService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly lines: OfficeLinesService,
        private readonly cards: OfficeCardsService,
        private readonly images: BrandImagesService,
    ) {}

    /** Posts one card into the Marketing room; answers the text line it posted as the card's preview. */
    async emit(scope: CardScope, card: MarketingCard): Promise<string> {
        const body = this.textOf(scope.locale, card)
        await this.cards.postAsDepartment({ workspaceId: scope.workspaceId }, DEPARTMENT, {
            room: ROOM,
            body,
            leadId: null,
            workItemId: card.workItemId,
            card: await this.hubCardOf(scope.locale, card),
        })
        return body
    }

    /** Posts a plain line of the AI Marketing agent (a failure the owner should see). */
    async line(scope: CardScope, body: string, workItemId: string | null): Promise<void> {
        await this.lines.post(
            { workspaceId: scope.workspaceId },
            { body, lead_id: null, work_item_id: workItemId, dept: DEPARTMENT },
        )
    }

    /** The one text line a card reads as without the Hub card renderer. */
    textOf(locale: Locale, card: MarketingCard): string {
        const text = (key: string, params: Readonly<Record<string, string>>): string =>
            this.catalog.get(key, params, locale)
        switch (card.kind) {
            case "draft_post":
                return text("marketing.draftCard", { title: card.title })
            case "approval_request":
                return text("marketing.approvalCard", { title: card.title, channels: card.channels.join(", ") })
            case "schedule_confirmed":
                return text("marketing.scheduledCard", {
                    title: card.title,
                    at: card.scheduledAt,
                    channels: card.channels.map((entry) => entry.channel).join(", "),
                })
            case "weekly_report":
                return text("marketing.reportCard", {
                    from: card.report.weekStart,
                    to: card.report.weekEnd,
                    reach: String(card.report.reach.value),
                    engagements: String(card.report.engagements.value),
                    messages: String(card.report.messages.value),
                })
        }
    }

    /** The Hub card v1 payload of a marketing card in `locale`, cut to the Hub limits. */
    hubCardOf(locale: Locale, card: MarketingCard): Promise<HubCard> {
        const words = this.wordsOf(locale)
        switch (card.kind) {
            case "draft_post":
                return this.draftCard(words, card)
            case "approval_request":
                return Promise.resolve(approvalCard(words, card))
            case "schedule_confirmed":
                return Promise.resolve(scheduledCard(words, card))
            case "weekly_report":
                return Promise.resolve(reportCard(locale, words, card))
        }
    }

    /** The card words of `locale`, read from the AI Marketing catalog. */
    private wordsOf(locale: Locale): Words {
        const say = (key: string, params: Readonly<Record<string, string>>): string =>
            this.catalog.get(key, params, locale)
        const word = (key: string): string => say(key, {})
        return {
            approval: word("marketing.word.approval"),
            brandKit: word("marketing.word.brandKit"),
            channels: word("marketing.word.channels"),
            engagements: word("marketing.word.engagements"),
            mediaLibrary: word("marketing.word.mediaLibrary"),
            messages: word("marketing.word.messages"),
            notScheduled: word("marketing.word.notScheduled"),
            ownerRequest: word("marketing.word.ownerRequest"),
            pageInsights: word("marketing.word.pageInsights"),
            publishAt: word("marketing.word.publishAt"),
            publishedPosts: word("marketing.word.publishedPosts"),
            customerMessages: word("marketing.word.customerMessages"),
            zaloArticles: word("marketing.word.zaloArticles"),
            reach: word("marketing.word.reach"),
            report: word("marketing.word.report"),
            scheduled: word("marketing.word.scheduled"),
            say,
        }
    }

    private async draftCard(words: Words, card: DraftPostCard): Promise<HubCard> {
        const shown = card.images.slice(0, 6)
        const signed = await Promise.all(
            shown.map(async (image, index) => {
                const url = (await this.images.urlsOf([image.path])).find((candidate) => HREF.test(candidate))
                const caption = words.say("marketing.word.imageCaption", {
                    index: String(index + 1),
                    width: String(image.width),
                    height: String(image.height),
                })
                return url === undefined ? [] : [{ kind: "image", url, caption }]
            }),
        )
        const media = signed.flat()
        const caption = [card.caption.trim(), card.hashtags.join(" ")].filter((part) => part !== "").join("\n\n")
        const sources = sourcesOf(words, card.sources)
        return {
            v: 1,
            type: "draft_post",
            title: clip(card.title, 160),
            ...(card.channels.length === 0 ? {} : { subtitle: clip(card.channels.join(" + "), 240) }),
            ...(caption === "" ? {} : { body: caption.slice(0, 4000) }),
            ...(media.length === 0 ? {} : { media }),
            lines: card.script.slice(0, 20).map((beat) => ({ at: beat.at.slice(0, 40), text: clip(beat.line, 400) })),
            ...(sources.length === 0 ? {} : { sources }),
            data: { content_item_id: card.contentItemId },
        }
    }
}
