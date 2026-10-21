import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { DirectGenerationService } from "@modules/domain/ai-generations"
import { ContentApprovalStoreService, ContentItemsService } from "@modules/domain/content-items"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BrandImagesService } from "./brand-images.service"
import { BrandKitService } from "./brand-kit.service"
import { MarketingCardsService } from "./marketing-cards.service"
import { MarketingVideoService } from "./marketing-video.service"
import { MarketingDraftService } from "./marketing-draft.service"
import { MarketingKnowledgeService } from "./marketing-knowledge.service"

const CTX: WorkContext = { workspaceId: "ws-1", actor: "Mai Linh", locale: "vi" }
const SCOPE = { workspaceId: "ws-1", locale: "vi" }
const DRAFT = {
    title: "A weekend",
    caption: "Leave the rush behind.",
    hashtags: ["#HAKUEN"],
    images: [
        { headline: "Quiet moment", subline: "-20%" },
        { headline: "Calm", subline: "Spa" },
    ],
    script: ["Candles", "Massage", "Logo"],
}
const IMAGES = [
    { path: "ws-1/marketing/1-1.png", width: 1200, height: 800 },
    { path: "ws-1/marketing/1-2.png", width: 1200, height: 800 },
]
const ITEM = {
    id: "c-1",
    variants: { facebook: { text: "t", hashtags: [], note: "" } },
    channels: ["facebook", "zalo"],
}

const GUIDANCE = {
    lessons: ["Shorter captions: keep three lines"],
    templates: [],
    sources: [{ layer: 3, ref: "lesson-1", label: "Shorter captions" }],
}

const build = async () => {
    const generations = mock<DirectGenerationService>()
    const brand = mock<BrandKitService>()
    const images = mock<BrandImagesService>()
    const cards = mock<MarketingCardsService>()
    const engine = mock<WorkEngineService>()
    const approvals = mock<ContentApprovalStoreService>()
    const items = mock<ContentItemsService>()
    const logger = mock<Logger>()
    const knowledge = mock<MarketingKnowledgeService>()
    knowledge.guidanceOf.mockResolvedValue(GUIDANCE)
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key: string) => key)
    brand.brandOf.mockResolvedValue({ kit: null, logoPath: "ws-1/logo.png" })
    images.compose.mockResolvedValue(IMAGES)
    items.createAgentDraft.mockResolvedValue(ITEM)
    engine.runWork.mockImplementation(async (_ctx: WorkContext, spec: Parameters<WorkEngineService["runWork"]>[1]) => {
        const row = mock<WorkItem>({ id: "w-approve" })
        await spec.onInserted?.(row)
        return row
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            MarketingDraftService,
            { provide: CLOCK, useValue: new FakeClock("2026-10-20T07:00:00.000Z") },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
            { provide: DirectGenerationService, useValue: generations },
            { provide: BrandKitService, useValue: brand },
            { provide: BrandImagesService, useValue: images },
            { provide: MarketingCardsService, useValue: cards },
            { provide: WorkEngineService, useValue: engine },
            { provide: ContentApprovalStoreService, useValue: approvals },
            { provide: ContentItemsService, useValue: items },
            {
                provide: MarketingVideoService,
                useValue: mock<MarketingVideoService>({ delegate: jest.fn(() => Promise.resolve(true)) }),
            },
            { provide: MarketingKnowledgeService, useValue: knowledge },
        ],
    }).compile()
    const service = moduleRef.get(MarketingDraftService)
    return { service, generations, images, cards, engine, approvals, items, logger, brand, knowledge }
}

const ok = (output: string) =>
    ({ ok: true, output, generationId: "g", timings: {}, usage: null }) satisfies {
        ok: true
        output: string
        generationId: string
        timings: Record<string, number>
        usage: null
    }

describe("MarketingDraftService", () => {
    it("drafts, composes the images, stores the post, posts the draft card and the approval card", async () => {
        const { service, generations, images, cards, engine, approvals, items, knowledge } = await build()
        generations.run.mockResolvedValue(ok(JSON.stringify(DRAFT)))

        await expect(
            service.draft(CTX, { request: "spa offer 20%", workItemId: "w-1", scheduledAt: null }),
        ).resolves.toEqual({
            ok: true,
            reason: "",
            contentItemId: "c-1",
            approvalWorkItemId: "w-approve",
        })

        expect(generations.run).toHaveBeenCalledWith(expect.objectContaining({ purpose: "marketing_draft" }))
        expect(knowledge.guidanceOf).toHaveBeenCalledWith("ws-1", "spa offer 20%")
        expect(generations.run.mock.calls[0]?.[0].messages[0]?.content).toContain(
            "- Shorter captions: keep three lines",
        )
        expect(images.compose).toHaveBeenCalledWith(
            expect.objectContaining({ workspaceId: "ws-1", logoPath: "ws-1/logo.png", copies: DRAFT.images }),
        )
        expect(items.createAgentDraft).toHaveBeenCalledWith(
            expect.objectContaining({
                brief: "spa offer 20%\n\n00-05s Candles\n05-10s Massage\n10-15s Logo",
                scheduledAt: "2026-10-21T02:00:00.000Z",
                imagePaths: ["ws-1/marketing/1-1.png", "ws-1/marketing/1-2.png"],
                channels: ["facebook", "zalo"],
            }),
        )
        expect(cards.emit).toHaveBeenNthCalledWith(
            1,
            SCOPE,
            expect.objectContaining({
                kind: "draft_post",
                workItemId: "w-1",
                contentItemId: "c-1",
                images: IMAGES,
                sources: [
                    { layer: 2, ref: "brand_kit:none", label: "brand_kit:none" },
                    { layer: 2, ref: "media_library", label: "media_library" },
                    { layer: 2, ref: "owner_request", label: "owner_request" },
                    { layer: 3, ref: "lesson-1", label: "Shorter captions" },
                ],
            }),
        )
        expect(engine.runWork).toHaveBeenCalledWith(
            CTX,
            expect.objectContaining({ action: "publish_post", subject_id: "c-1", forceAsk: "over_authority" }),
        )
        expect(approvals.claimSubmission).toHaveBeenCalledWith(
            "ws-1",
            "c-1",
            "w-approve",
            expect.objectContaining({ kind: "submitted" }),
            { variants: ITEM.variants, channels: ITEM.channels },
        )
        expect(cards.emit).toHaveBeenNthCalledWith(
            2,
            SCOPE,
            expect.objectContaining({ kind: "approval_request", workItemId: "w-approve" }),
        )
    })
})

describe("MarketingDraftService (continued)", () => {
    it("keeps the request alone as brief when there is no script", async () => {
        const { service, generations, items, cards, brand } = await build()
        brand.brandOf.mockResolvedValue({
            kit: { brandName: "HAKUEN", colors: [], fonts: [], tone: "Warm", address: "", imagery: [], avoid: [] },
            logoPath: null,
        })
        generations.run.mockResolvedValue(ok(JSON.stringify({ ...DRAFT, script: [] })))

        await service.draft(CTX, { request: "r", workItemId: null, scheduledAt: "2026-10-24T02:00:00.000Z" })

        expect(items.createAgentDraft).toHaveBeenCalledWith(
            expect.objectContaining({ brief: "r", scheduledAt: "2026-10-24T02:00:00.000Z" }),
        )
        expect(cards.emit).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                sources: expect.arrayContaining([{ layer: 2, ref: "brand_kit:HAKUEN", label: "brand_kit:HAKUEN" }]),
            }),
        )
    })

    it("posts the reason and stops when the model fails or answers no draft", async () => {
        const { service, generations, cards, images } = await build()
        generations.run.mockResolvedValueOnce({ ok: false, reason: "quota", message: "out of credit" })
        generations.run.mockResolvedValueOnce(ok("{}"))

        await expect(service.draft(CTX, { request: "r", workItemId: "w-1", scheduledAt: null })).resolves.toMatchObject(
            {
                ok: false,
                reason: "out of credit",
            },
        )
        await expect(service.draft(CTX, { request: "r", workItemId: "w-1", scheduledAt: null })).resolves.toMatchObject(
            {
                ok: false,
                reason: "unreadable draft",
            },
        )
        expect(cards.line).toHaveBeenCalledTimes(2)
        expect(images.compose).not.toHaveBeenCalled()
    })

    it("logs, posts the reason and stops when the images cannot be composed", async () => {
        const { service, generations, images, cards, items, logger } = await build()
        generations.run.mockResolvedValue(ok(JSON.stringify(DRAFT)))
        images.compose.mockRejectedValueOnce(new Error("ffmpeg missing"))
        images.compose.mockRejectedValueOnce("odd")

        await expect(service.draft(CTX, { request: "r", workItemId: null, scheduledAt: null })).resolves.toMatchObject({
            ok: false,
            reason: "images",
        })
        await service.draft(CTX, { request: "r", workItemId: null, scheduledAt: null })
        expect(cards.line).toHaveBeenCalledWith(SCOPE, "marketing.draftFailed", null)
        expect(logger.error).toHaveBeenCalledTimes(2)
        expect(items.createAgentDraft).not.toHaveBeenCalled()
    })
})
