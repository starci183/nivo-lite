import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { OfficeCardsService, OfficeLinesService } from "@modules/domain/messages"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { BrandImagesService } from "./brand-images.service"
import { MarketingCardsService } from "./marketing-cards.service"
import type { CardScope } from "./marketing-cards.service"
import type { MarketingWeeklyReport } from "./content-agent.contracts"
import type { DraftPostCard, WeeklyReportCard } from "./marketing-cards.contracts"

const anything = (): unknown => expect.anything()
const without = (shape: Record<string, unknown>): unknown => expect.not.objectContaining(shape)

const build = async () => {
    const lines = mock<OfficeLinesService>()
    const cards = mock<OfficeCardsService>()
    const images = mock<BrandImagesService>()
    images.urlsOf.mockImplementation((paths) => Promise.resolve(paths.map((path) => `https://storage/${path}`)))
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params, locale) =>
        Object.keys(params).length === 0 ? `${locale}:${key}` : `${locale}:${key} ${JSON.stringify(params)}`,
    )
    const moduleRef = await Test.createTestingModule({
        providers: [
            MarketingCardsService,
            { provide: OfficeLinesService, useValue: lines },
            { provide: OfficeCardsService, useValue: cards },
            { provide: BrandImagesService, useValue: images },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    return { service: moduleRef.get(MarketingCardsService), lines, cards, images }
}

const SCOPE: CardScope = { workspaceId: "ws-1", locale: "vi" }

const REPORT: MarketingWeeklyReport = {
    weekStart: "2026-10-12",
    weekEnd: "2026-10-18",
    reach: { value: 12480, previous: 10000, changePct: 25 },
    engagements: { value: 1286, previous: 1400, changePct: -8 },
    messages: { value: 48, previous: 0, changePct: null },
    days: [],
    channels: ["facebook"],
    posts: [
        {
            id: "PAGE_1",
            channel: "facebook",
            title: "Relax at HAKUEN",
            publishedAt: "2026-10-18T02:00:00.000Z",
            engagements: 1356,
            href: "https://facebook.com/1",
        },
    ],
    postCount: 8,
    suggestion: {
        title: "Short videos led",
        body: "Add two spa videos.",
        sources: [
            { layer: 1, kind: "connector", ref: "meta.page_insights", label: "facebook" },
            { layer: 1, kind: "connector", ref: "meta.published_posts", label: "8" },
            { layer: 1, kind: "connector", ref: "channel.messages", label: "facebook" },
            { layer: 1, kind: "connector", ref: "zalo.articles", label: "zalo" },
            { layer: 2, kind: "brain_fact", ref: "brand_kit:HAKUEN", label: "HAKUEN" },
        ],
    },
}

const DRAFT: DraftPostCard = {
    kind: "draft_post",
    workItemId: "w-1",
    contentItemId: "c-1",
    title: "Weekend",
    caption: "c",
    hashtags: ["#spa"],
    images: [
        { path: "ws-1/marketing/k-1.png", width: 1200, height: 800 },
        { path: "ws-1/marketing/k-2.png", width: 1200, height: 800 },
    ],
    script: [{ at: "00-05s", line: "Candles" }],
    channels: ["facebook", "zalo"],
    sources: [
        { layer: 1, ref: "meta.page_insights", label: "meta.page_insights" },
        { layer: 2, ref: "media_library", label: "media_library" },
        { layer: 2, ref: "brand_kit:none", label: "brand_kit:none" },
        { layer: 2, ref: "brand_kit:HAKUEN.pdf", label: "brand_kit:HAKUEN.pdf" },
        { layer: 3, ref: "owner_request", label: "owner_request" },
        { layer: 4, ref: "meta.published_posts", label: "meta.published_posts" },
        { layer: 4, ref: "tpl", label: "tpl" },
        { layer: 7, ref: "out of range", label: "out of range" },
    ],
}

const reportCard = (report: MarketingWeeklyReport): WeeklyReportCard => ({
    kind: "weekly_report",
    workItemId: null,
    report,
})

describe("MarketingCardsService / draft_post", () => {
    it("posts a draft card of the content agent in the Marketing room, tied to its work item", async () => {
        const { service, cards, images } = await build()
        images.urlsOf.mockResolvedValueOnce(["https://storage/ws-1/marketing/k-1.png"])
        images.urlsOf.mockResolvedValueOnce(["//not-allowed"])

        const body = await service.emit(SCOPE, DRAFT)

        expect(body).toBe('vi:marketing.draftCard {"title":"Weekend"}')
        expect(cards.postAsDepartment).toHaveBeenCalledWith({ workspaceId: "ws-1" }, "content", {
            room: "marketing",
            body,
            leadId: null,
            workItemId: "w-1",
            card: {
                v: 1,
                type: "draft_post",
                title: "Weekend",
                subtitle: "facebook + zalo",
                body: "c\n\n#spa",
                media: [
                    {
                        kind: "image",
                        url: "https://storage/ws-1/marketing/k-1.png",
                        caption: 'vi:marketing.word.imageCaption {"index":"1","width":"1200","height":"800"}',
                    },
                ],
                lines: [{ at: "00-05s", text: "Candles" }],
                sources: [
                    { layer: 1, kind: "mcp_tool", ref: "meta.page_insights", label: "vi:marketing.word.pageInsights" },
                    { layer: 2, kind: "brain_document", ref: "media_library", label: "vi:marketing.word.mediaLibrary" },
                    {
                        layer: 2,
                        kind: "brain_document",
                        ref: "brand_kit:HAKUEN.pdf",
                        label: "vi:marketing.word.brandKit: HAKUEN.pdf",
                    },
                    { layer: 3, kind: "brain_lesson", ref: "owner_request", label: "vi:marketing.word.ownerRequest" },
                    {
                        layer: 4,
                        kind: "base_document",
                        ref: "meta.published_posts",
                        label: "vi:marketing.word.publishedPosts",
                    },
                    { layer: 4, kind: "base_document", ref: "tpl", label: "tpl" },
                ],
                data: { content_item_id: "c-1" },
            },
        })
    })

    it("leaves out the empty parts of a bare draft and falls back on a blank title", async () => {
        const { service } = await build()

        const card = await service.hubCardOf("en", {
            ...DRAFT,
            title: "   ",
            caption: " ",
            hashtags: [],
            images: [],
            script: [],
            channels: [],
            sources: [],
        })

        expect(card).toEqual({ v: 1, type: "draft_post", title: "-", lines: [], data: { content_item_id: "c-1" } })
    })
})

describe("MarketingCardsService / approval and schedule", () => {
    it("words the approval card with its decision ref and Vietnam publish time", async () => {
        const { service } = await build()
        const approval = {
            kind: "approval_request" as const,
            workItemId: "w-2",
            contentItemId: "c-1",
            title: "T",
            channels: ["facebook", "zalo"],
            scheduledAt: "2026-10-21T02:00:00.000Z",
        }

        await expect(service.hubCardOf("vi", approval)).resolves.toEqual({
            v: 1,
            type: "approval_request",
            title: "T",
            badge: "vi:marketing.word.approval",
            fields: [
                { label: "vi:marketing.word.channels", value: "facebook + zalo" },
                { label: "vi:marketing.word.publishAt", value: "09:00 21/10/2026" },
            ],
            ref: { kind: "work_item", id: "w-2" },
            actions: ["approve", "decline"],
            data: { content_item_id: "c-1" },
        })
        const unbound = await service.hubCardOf("vi", { ...approval, workItemId: null, scheduledAt: "soon" })
        expect(unbound).toEqual(without({ ref: anything() }))
        expect(unbound.fields).toEqual([
            { label: "vi:marketing.word.channels", value: "facebook + zalo" },
            { label: "vi:marketing.word.publishAt", value: "soon" },
        ])
        expect(service.textOf("vi", approval)).toBe(
            'vi:marketing.approvalCard {"title":"T","channels":"facebook, zalo"}',
        )
    })

    it("lists each channel that took the post and the refusals as text", async () => {
        const { service } = await build()
        const scheduled = {
            kind: "schedule_confirmed" as const,
            workItemId: "w-2",
            contentItemId: "c-1",
            title: "T",
            scheduledAt: "2026-10-21T02:00:00.000Z",
            channels: [{ channel: "facebook", ref: "p_1" }],
            failed: [{ channel: "zalo", reason: "zalo_cover_missing" }],
        }

        await expect(service.hubCardOf("en", scheduled)).resolves.toEqual({
            v: 1,
            type: "schedule_confirmed",
            title: "T",
            badge: "en:marketing.word.scheduled",
            body: "zalo: zalo_cover_missing",
            fields: [{ label: "facebook", value: "09:00 21/10/2026" }],
            data: { content_item_id: "c-1" },
        })
        await expect(service.hubCardOf("en", { ...scheduled, channels: [], failed: [] })).resolves.toEqual({
            v: 1,
            type: "schedule_confirmed",
            title: "T",
            badge: "en:marketing.word.notScheduled",
            data: { content_item_id: "c-1" },
        })
        expect(service.textOf("en", scheduled)).toBe(
            'en:marketing.scheduledCard {"title":"T","at":"2026-10-21T02:00:00.000Z","channels":"facebook"}',
        )
    })
})

describe("MarketingCardsService / weekly_report", () => {
    it("draws the figures, the top posts, the suggestion and its sources", async () => {
        const { service } = await build()

        const card = await service.hubCardOf("en", reportCard(REPORT))

        expect(card).toEqual({
            v: 1,
            type: "weekly_report",
            title: "en:marketing.word.report",
            subtitle: 'en:marketing.word.period {"from":"2026-10-12","to":"2026-10-18"}',
            body: "Short videos led\n\nAdd two spa videos.",
            fields: [
                { label: "en:marketing.word.reach", value: "12,480 (+25%)" },
                { label: "en:marketing.word.engagements", value: "1,286 (-8%)" },
                { label: "en:marketing.word.messages", value: "48" },
            ],
            lines: [
                {
                    at: "18/10",
                    text: 'en:marketing.word.postLine {"title":"Relax at HAKUEN","count":"1,356"}',
                },
            ],
            sources: [
                { layer: 1, kind: "connector", ref: "meta.page_insights", label: "en:marketing.word.pageInsights" },
                {
                    layer: 1,
                    kind: "connector",
                    ref: "meta.published_posts",
                    label: "en:marketing.word.publishedPosts",
                },
                {
                    layer: 1,
                    kind: "connector",
                    ref: "channel.messages",
                    label: "en:marketing.word.customerMessages",
                },
                { layer: 1, kind: "connector", ref: "zalo.articles", label: "en:marketing.word.zaloArticles" },
                { layer: 2, kind: "brain_fact", ref: "brand_kit:HAKUEN", label: "en:marketing.word.brandKit: HAKUEN" },
            ],
            data: { ...REPORT },
        })
    })

    it("formats Vietnamese numbers and leaves out the posts, the advice and empty sources", async () => {
        const { service } = await build()
        const quiet = { ...REPORT, posts: [], suggestion: null }

        const card = await service.hubCardOf("vi", reportCard(quiet))
        const sourceless = await service.hubCardOf(
            "vi",
            reportCard({ ...REPORT, suggestion: { title: "t", body: "b", sources: [] } }),
        )

        expect(card.fields).toEqual([
            { label: "vi:marketing.word.reach", value: "12.480 (+25%)" },
            { label: "vi:marketing.word.engagements", value: "1.286 (-8%)" },
            { label: "vi:marketing.word.messages", value: "48" },
        ])
        expect(Object.keys(card)).toEqual(["v", "type", "title", "subtitle", "fields", "data"])
        expect(sourceless.body).toBe("t\n\nb")
        expect(sourceless).toEqual(without({ sources: anything() }))
        expect(service.textOf("vi", reportCard(REPORT))).toBe(
            'vi:marketing.reportCard {"from":"2026-10-12","to":"2026-10-18","reach":"12480","engagements":"1286","messages":"48"}',
        )
    })
})

describe("MarketingCardsService / line", () => {
    it("posts a plain line of the content agent", async () => {
        const { service, lines } = await build()

        await service.line(SCOPE, "oops", null)

        expect(lines.post).toHaveBeenCalledWith(
            { workspaceId: "ws-1" },
            { body: "oops", lead_id: null, work_item_id: null, dept: "content" },
        )
    })
})
