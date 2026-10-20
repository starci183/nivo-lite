import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { ZaloCredentialsService } from "@modules/domain/channels"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { ContentItemsService } from "@modules/domain/content-items"
import type { ScheduleView } from "@modules/domain/content-items"
import type { WorkContext } from "@modules/domain/decisions"
import { META_CLIENT } from "@modules/integrations/meta"
import type { MetaClient } from "@modules/integrations/meta"
import { ZALO } from "@modules/integrations/zalo"
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
        ],
    }).compile()
    const service = moduleRef.get(ContentScheduleService)
    return { service, meta, zalo, connections, credentials, items, images, cards, logger }
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
