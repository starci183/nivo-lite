import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { ZaloCredentialsService } from "@modules/domain/channels"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { ContentApprovalStoreService, ContentItemsService } from "@modules/domain/content-items"
import type { DueChannelPost, ScheduleView } from "@modules/domain/content-items"
import type { WorkContext } from "@modules/domain/decisions"
import { META_CLIENT } from "@modules/integrations/meta"
import type { MetaClient } from "@modules/integrations/meta"
import { ZALO, ZaloError, ZaloErrorCode } from "@modules/integrations/zalo"
import type { ZaloClient } from "@modules/integrations/zalo"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BrandImagesService } from "./brand-images.service"
import { ContentScheduleService } from "./content-schedule.service"
import { MarketingCardsService } from "./marketing-cards.service"

const CTX: WorkContext = { workspaceId: "ws-1", actor: "Mai Linh", locale: "vi" }
const ITEM: ScheduleView = {
    id: "c-1",
    title: "A weekend",
    channels: ["facebook", "zalo"],
    texts: { facebook: "Caption\n\n#HAKUEN", zalo: "Caption\n\n#HAKUEN" },
    mediaPaths: ["ws-1/marketing/1-1.png"],
    scheduledAt: "2026-10-24T02:00:00.000Z",
}
const REQUEST = { contentItemId: "c-1", workItemId: "w-1" }
const AT = "2026-10-24T02:00:00.000Z"

const build = async (item: ScheduleView | null = ITEM) => {
    const meta = mock<MetaClient>()
    const zalo = mock<ZaloClient>()
    const connections = mock<ConnectionsService>()
    const credentials = mock<ZaloCredentialsService>()
    const items = mock<ContentItemsService>()
    const images = mock<BrandImagesService>()
    const cards = mock<MarketingCardsService>()
    const logger = mock<Logger>()
    const approvals = mock<ContentApprovalStoreService>()
    items.scheduleViewOf.mockResolvedValue(item)
    connections.listByProvider.mockResolvedValue([mock<ConnectionRecord>({ id: "conn-1" })])
    connections.readSecret.mockResolvedValue({
        plain: JSON.stringify({ pageId: "PAGE", pageToken: "ptok" }),
        webhookSecret: "",
    })
    credentials.accessToken.mockResolvedValue("zalo-token")
    images.urlsOf.mockResolvedValue(["https://s/1.png"])
    meta.schedulePagePost.mockResolvedValue({ postId: "PAGE_1", photoIds: ["ph"], scheduledPublishTime: 1 })
    zalo.createArticle.mockResolvedValue("article-token")
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContentScheduleService,
            { provide: CLOCK, useValue: new FakeClock("2026-10-20T07:00:00.000Z") },
            { provide: LOGGER, useValue: logger },
            { provide: META_CLIENT, useValue: meta },
            { provide: ZALO, useValue: zalo },
            { provide: ConnectionsService, useValue: connections },
            { provide: ZaloCredentialsService, useValue: credentials },
            { provide: ContentItemsService, useValue: items },
            { provide: BrandImagesService, useValue: images },
            { provide: MarketingCardsService, useValue: cards },
            { provide: ContentApprovalStoreService, useValue: approvals },
        ],
    }).compile()
    const service = moduleRef.get(ContentScheduleService)
    return { service, meta, zalo, connections, credentials, items, images, cards, logger, approvals }
}

describe("ContentScheduleService", () => {
    it("schedules the Page post and the Zalo article, records the refs and posts the confirmation card", async () => {
        const { service, meta, zalo, items, images, cards } = await build()

        await expect(service.schedule(CTX, REQUEST)).resolves.toEqual([
            { channel: "facebook", ref: "PAGE_1" },
            { channel: "zalo", ref: "article-token" },
        ])

        expect(images.urlsOf).toHaveBeenCalledWith(["ws-1/marketing/1-1.png"])
        expect(meta.schedulePagePost).toHaveBeenCalledWith(
            { pageId: "PAGE", pageToken: "ptok" },
            { message: "Caption\n\n#HAKUEN", imageUrls: ["https://s/1.png"], publishAt: new Date(AT) },
        )
        expect(zalo.createArticle).toHaveBeenCalledWith(
            "zalo-token",
            expect.objectContaining({
                coverUrl: "https://s/1.png",
                paragraphs: ["Caption", "#HAKUEN"],
                publish: false,
            }),
        )
        expect(items.markScheduled).toHaveBeenCalledWith("ws-1", "c-1", [
            { channel: "facebook", ref: "PAGE_1", scheduledAt: AT },
            { channel: "zalo", ref: "article-token", scheduledAt: AT },
        ])
        expect(cards.emit).toHaveBeenCalledWith(
            { workspaceId: "ws-1", locale: "vi" },
            expect.objectContaining({ kind: "schedule_confirmed", workItemId: "w-1", failed: [] }),
        )
    })

    it("reports each refused channel with its reason and logs it", async () => {
        const { service, connections, images, cards, logger } = await build({
            ...ITEM,
            channels: ["facebook", "zalo", "tiktok"],
            texts: {},
        })
        connections.readSecret.mockResolvedValue({ plain: "{}", webhookSecret: "" })
        images.urlsOf.mockResolvedValue([])

        await expect(service.schedule(CTX, REQUEST)).resolves.toEqual([])
        expect(cards.emit).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                failed: [
                    { channel: "facebook", reason: "facebook_page_missing" },
                    { channel: "zalo", reason: "zalo_cover_missing" },
                    { channel: "tiktok", reason: "tiktok_unsupported" },
                ],
            }),
        )
        expect(logger.error).toHaveBeenCalledTimes(3)
    })
})

describe("ContentScheduleService (continued)", () => {
    it("names a missing connection, a missing credential and a provider failure", async () => {
        const none = await build({ ...ITEM, channels: ["facebook"] })
        none.connections.listByProvider.mockResolvedValue([])
        await none.service.schedule(CTX, REQUEST)
        expect(none.cards.emit).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ failed: [{ channel: "facebook", reason: "meta_not_connected" }] }),
        )
        const sealed = await build({ ...ITEM, channels: ["facebook"] })
        sealed.connections.readSecret.mockResolvedValue(null)
        await sealed.service.schedule(CTX, REQUEST)
        expect(sealed.cards.emit).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ failed: [{ channel: "facebook", reason: "meta_credential_missing" }] }),
        )
        const down = await build({ ...ITEM, channels: ["zalo"] })
        down.zalo.createArticle.mockRejectedValueOnce(new Error("Zalo down"))
        await down.service.schedule(CTX, REQUEST)
        down.zalo.createArticle.mockRejectedValueOnce("odd")
        await down.service.schedule(CTX, REQUEST)
        expect(down.cards.emit).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ failed: [{ channel: "zalo", reason: "Zalo down" }] }),
        )
        expect(down.cards.emit).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ failed: [{ channel: "zalo", reason: "error" }] }),
        )
    })

    it("leaves a post that is gone alone", async () => {
        const { service, cards } = await build(null)

        await expect(service.schedule(CTX, REQUEST)).resolves.toEqual([])
        expect(cards.emit).not.toHaveBeenCalled()
    })
})

const DUE: DueChannelPost = {
    ...ITEM,
    workspaceId: "ws-1",
    ref: "article-token",
    scheduledAt: "2026-10-20T06:00:00.000Z",
}
const NOW = "2026-10-20T07:00:00.000Z"

describe("ContentScheduleService / publishDue", () => {
    it("shows each due Zalo article and records the channel as published by AI Marketing", async () => {
        const { service, zalo, items, approvals, credentials } = await build()
        items.dueOnChannel.mockResolvedValue([DUE, { ...DUE, id: "c-2", texts: {} }])
        zalo.publishArticle.mockResolvedValue("art-1")

        await expect(service.publishDue()).resolves.toBe(2)
        expect(zalo.publishArticle.mock.calls[1]?.[2]).toMatchObject({ description: "", paragraphs: [""] })

        expect(items.dueOnChannel).toHaveBeenCalledWith("zalo", NOW, 50)
        expect(credentials.accessToken).toHaveBeenCalledWith("conn-1")
        expect(zalo.publishArticle).toHaveBeenCalledWith(
            "zalo-token",
            "article-token",
            expect.objectContaining({
                title: "A weekend",
                coverUrl: "https://s/1.png",
                paragraphs: ["Caption", "#HAKUEN"],
            }),
        )
        expect(approvals.markPublished).toHaveBeenCalledWith(
            "ws-1",
            "c-1",
            "zalo",
            { at: NOW, by: "AI Marketing", url: "", how: "zalo_article:art-1" },
            { at: NOW, kind: "published", by: "AI Marketing", text: "zalo_article:art-1" },
        )
    })

    it("leaves the post due when Zalo cannot be reached", async () => {
        const { service, zalo, items, approvals, cards, logger } = await build()
        items.dueOnChannel.mockResolvedValue([DUE])
        zalo.publishArticle.mockRejectedValue(new ZaloError({ code: ZaloErrorCode.Unavailable }))

        await expect(service.publishDue()).resolves.toBe(0)

        expect(logger.error).toHaveBeenCalledWith("marketing.publish.failed", expect.any(ZaloError), {
            workspaceId: "ws-1",
            contentItemId: "c-1",
        })
        expect(approvals.markPublished).not.toHaveBeenCalled()
        expect(items.markChannelFailed).not.toHaveBeenCalled()
        expect(cards.emit).not.toHaveBeenCalled()
    })
})

describe("ContentScheduleService / publishDue refusals", () => {
    it("records a refusal on the post and says it in the Marketing room", async () => {
        const { service, items, images, cards } = await build()
        items.dueOnChannel.mockResolvedValue([DUE])
        images.urlsOf.mockResolvedValueOnce([])

        await expect(service.publishDue()).resolves.toBe(0)

        expect(items.markChannelFailed).toHaveBeenCalledWith("ws-1", "c-1", "zalo", "zalo_cover_missing", NOW)
        expect(cards.emit).toHaveBeenCalledWith(
            { workspaceId: "ws-1", locale: "vi" },
            {
                kind: "schedule_confirmed",
                workItemId: null,
                contentItemId: "c-1",
                title: "A weekend",
                scheduledAt: "2026-10-20T06:00:00.000Z",
                channels: [],
                failed: [{ channel: "zalo", reason: "zalo_cover_missing" }],
            },
        )
    })

    it("dates the refusal card at the tick when the post has no scheduled moment", async () => {
        const { service, items, connections, cards } = await build()
        items.dueOnChannel.mockResolvedValue([{ ...DUE, texts: {}, scheduledAt: null }])
        connections.listByProvider.mockResolvedValue([])

        await service.publishDue()

        expect(items.markChannelFailed).toHaveBeenCalledWith("ws-1", "c-1", "zalo", "zalo_oa_not_connected", NOW)
        expect(cards.emit).toHaveBeenCalledWith(
            { workspaceId: "ws-1", locale: "vi" },
            expect.objectContaining({ scheduledAt: NOW }),
        )
    })
})
