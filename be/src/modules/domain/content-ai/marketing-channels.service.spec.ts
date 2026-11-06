import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { ZaloCredentialsService } from "@modules/domain/channels"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { ContentEngagementDailyService } from "@modules/domain/content-engagement-daily"
import { META_CLIENT } from "@modules/integrations/meta"
import type { MetaClient } from "@modules/integrations/meta"
import { ZALO_ARTICLES } from "@modules/integrations/zalo"
import type { ZaloArticleClient } from "@modules/integrations/zalo"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MarketingChannelsService } from "./marketing-channels.service"

// Tuesday 2026-10-20 14:00 in Vietnam.
const NOW = "2026-10-20T07:00:00.000Z"
const INSIGHTS = [{ day: "2026-10-12", reach: 100, engagements: 10 }]

const build = async () => {
    const meta = mock<MetaClient>()
    const zalo = mock<ZaloArticleClient>()
    const connections = mock<ConnectionsService>()
    const credentials = mock<ZaloCredentialsService>()
    const daily = mock<ContentEngagementDailyService>()
    const logger = mock<Logger>()
    connections.listByProvider.mockImplementation((_workspaceId, provider) =>
        Promise.resolve([mock<ConnectionRecord>({ id: provider === "meta" ? "conn-meta" : "conn-zalo" })]),
    )
    connections.readSecret.mockResolvedValue({
        plain: JSON.stringify({ pageId: "PAGE", pageToken: "ptok" }),
        webhookSecret: "",
    })
    credentials.accessToken.mockResolvedValue("zalo-token")
    meta.pageInsights.mockResolvedValue(INSIGHTS)
    daily.upsert.mockResolvedValue(1)
    const moduleRef = await Test.createTestingModule({
        providers: [
            MarketingChannelsService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
            { provide: META_CLIENT, useValue: meta },
            { provide: ZALO_ARTICLES, useValue: zalo },
            { provide: ConnectionsService, useValue: connections },
            { provide: ZaloCredentialsService, useValue: credentials },
            { provide: ContentEngagementDailyService, useValue: daily },
        ],
    }).compile()
    const service = moduleRef.get(MarketingChannelsService)
    return { service, meta, zalo, connections, credentials, daily, logger }
}

describe("MarketingChannelsService sync", () => {
    it("reads fifteen days of Page insights into the daily table", async () => {
        const { service, meta, daily } = await build()

        await expect(service.sync("ws-1")).resolves.toBe(1)

        expect(meta.pageInsights).toHaveBeenCalledWith(
            { pageId: "PAGE", pageToken: "ptok" },
            "2026-10-05",
            "2026-10-20",
        )
        expect(daily.upsert).toHaveBeenCalledWith("ws-1", "facebook", INSIGHTS)
    })

    it("stores nothing without a live Page or with an incomplete credential", async () => {
        const { service, connections, meta, daily } = await build()
        connections.listByProvider.mockResolvedValueOnce([])
        await expect(service.sync("ws-1")).resolves.toBe(0)
        connections.readSecret.mockResolvedValueOnce(null)
        await expect(service.sync("ws-1")).resolves.toBe(0)
        connections.readSecret.mockResolvedValueOnce({ plain: JSON.stringify({ pageId: "PAGE" }), webhookSecret: "" })
        await expect(service.sync("ws-1")).resolves.toBe(0)
        expect(meta.pageInsights).not.toHaveBeenCalled()
        expect(daily.upsert).not.toHaveBeenCalled()
    })
})

describe("MarketingChannelsService isConnected", () => {
    it("is true with a live Page or a live OA, false with neither", async () => {
        const { service, connections } = await build()

        await expect(service.isConnected("ws-1")).resolves.toBe(true)

        connections.listByProvider.mockImplementation((_workspaceId, provider) =>
            Promise.resolve(provider === "meta" ? [] : [mock<ConnectionRecord>({ id: "conn-zalo" })]),
        )
        await expect(service.isConnected("ws-1")).resolves.toBe(true)

        connections.listByProvider.mockResolvedValue([])
        await expect(service.isConnected("ws-1")).resolves.toBe(false)
    })
})

describe("MarketingChannelsService postsOf", () => {
    it("reads the Page posts of the window and the shown OA articles, with what each channel counted", async () => {
        const { service, meta, zalo, credentials } = await build()
        meta.publishedPosts.mockResolvedValue([
            {
                id: "PAGE_1",
                message: "Relax",
                createdTime: "2026-10-18T02:00:00.000Z",
                permalink: "https://facebook.com/1",
                engagements: 356,
            },
        ])
        zalo.list.mockResolvedValue([
            {
                id: "art-1",
                title: "Weekend",
                status: "show",
                createdAt: "2026-10-17T02:00:00.000Z",
                views: 120,
                shares: 4,
            },
            { id: "art-2", title: "Draft", status: "hide", createdAt: "2026-10-17T02:00:00.000Z", views: 0, shares: 0 },
        ])

        const posts = await service.postsOf("ws-1", "2026-10-12", "2026-10-19")

        expect(meta.publishedPosts).toHaveBeenCalledWith(
            { pageId: "PAGE", pageToken: "ptok" },
            "2026-10-12",
            "2026-10-19",
        )
        expect(credentials.accessToken).toHaveBeenCalledWith("conn-zalo")
        expect(posts).toEqual([
            {
                id: "PAGE_1",
                channel: "facebook",
                message: "Relax",
                publishedAt: "2026-10-18T02:00:00.000Z",
                engagements: 356,
                href: "https://facebook.com/1",
            },
            {
                id: "art-1",
                channel: "zalo",
                message: "Weekend",
                publishedAt: "2026-10-17T02:00:00.000Z",
                engagements: 124,
                href: null,
            },
        ])
    })

    it("reads nothing from a channel that is not connected", async () => {
        const { service, connections, meta, zalo } = await build()
        connections.listByProvider.mockResolvedValue([])

        await expect(service.postsOf("ws-1", "2026-10-12", "2026-10-19")).resolves.toEqual([])
        expect(meta.publishedPosts).not.toHaveBeenCalled()
        expect(zalo.list).not.toHaveBeenCalled()
    })

    it("leaves out a channel that fails and logs it", async () => {
        const { service, meta, zalo, logger } = await build()
        meta.publishedPosts.mockRejectedValue(new Error("Meta down"))
        zalo.list.mockRejectedValue(new Error("Zalo down"))

        await expect(service.postsOf("ws-1", "2026-10-12", "2026-10-19")).resolves.toEqual([])
        expect(logger.error).toHaveBeenCalledWith("marketing.insights.posts_failed", new Error("Meta down"), {
            workspaceId: "ws-1",
        })
        expect(logger.error).toHaveBeenCalledWith("marketing.insights.posts_failed", new Error("Zalo down"), {
            workspaceId: "ws-1",
        })
    })
})
