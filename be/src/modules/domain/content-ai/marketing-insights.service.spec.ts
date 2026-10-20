import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { ContentEngagementDailyService } from "@modules/domain/content-engagement-daily"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { META_CLIENT } from "@modules/integrations/meta"
import type { MetaClient } from "@modules/integrations/meta"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MarketingCardsService } from "./marketing-cards.service"
import { MarketingInsightsService } from "./marketing-insights.service"

// Tuesday 2026-10-20 14:00 in Vietnam: the last complete week starts Monday the 12th.
const NOW = "2026-10-20T07:00:00.000Z"
const DAYS = [
    { channel: "facebook", day: "2026-10-12", reach: 100, engagements: 10, messages: 2 },
    { channel: "facebook", day: "2026-10-06", reach: 50, engagements: 5, messages: 1 },
]
const REPORTED = [
    { day: "2026-10-12", reach: 100, engagements: 10 },
    { day: "2026-10-13", reach: 80, engagements: 7 },
]

const build = async () => {
    const meta = mock<MetaClient>()
    const connections = mock<ConnectionsService>()
    const members = mock<WorkspaceMembersService>()
    const cards = mock<MarketingCardsService>()
    const daily = mock<ContentEngagementDailyService>()
    const logger = mock<Logger>()
    connections.listByProvider.mockResolvedValue([mock<ConnectionRecord>({ id: "conn-1" })])
    connections.readSecret.mockResolvedValue({
        plain: JSON.stringify({ pageId: "PAGE", pageToken: "ptok" }),
        webhookSecret: "",
    })
    meta.pageInsights.mockResolvedValue(REPORTED)
    daily.upsert.mockResolvedValue(2)
    daily.between.mockResolvedValue(DAYS)
    const moduleRef = await Test.createTestingModule({
        providers: [
            MarketingInsightsService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
            { provide: META_CLIENT, useValue: meta },
            { provide: ConnectionsService, useValue: connections },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: MarketingCardsService, useValue: cards },
            { provide: ContentEngagementDailyService, useValue: daily },
        ],
    }).compile()
    const service = moduleRef.get(MarketingInsightsService)
    return { service, meta, connections, members, cards, daily, logger }
}

describe("MarketingInsightsService sync", () => {
    it("reads fifteen days of Page insights into the daily table", async () => {
        const { service, meta, daily } = await build()

        await expect(service.sync("ws-1")).resolves.toBe(2)

        expect(meta.pageInsights).toHaveBeenCalledWith(
            { pageId: "PAGE", pageToken: "ptok" },
            "2026-10-05",
            "2026-10-20",
        )
        expect(daily.upsert).toHaveBeenCalledWith("ws-1", "facebook", REPORTED)
    })

    it("stores nothing without a live Page or with an incomplete credential", async () => {
        const { service, connections, meta } = await build()
        connections.listByProvider.mockResolvedValueOnce([])
        await expect(service.sync("ws-1")).resolves.toBe(0)
        connections.readSecret.mockResolvedValueOnce(null)
        await expect(service.sync("ws-1")).resolves.toBe(0)
        expect(meta.pageInsights).not.toHaveBeenCalled()
    })
})

describe("MarketingInsightsService report", () => {
    it("reports the last complete week for a member, or the week asked", async () => {
        const { service, members, daily } = await build()

        const report = await service.report("person-1", "ws-1", "")

        expect(members.require).toHaveBeenCalledWith("person-1", "ws-1")
        expect(report.weekStart).toBe("2026-10-12")
        expect(report.engagements).toEqual({ value: 10, previous: 5, changePct: 100 })
        expect(daily.between).toHaveBeenCalledWith("ws-1", "2026-10-05", "2026-10-19")
        await expect(service.report("person-1", "ws-1", "2026-10-05")).resolves.toMatchObject({
            weekStart: "2026-10-05",
        })
    })

    it("syncs and posts the weekly report card, logging a failed sync", async () => {
        const { service, meta, cards, members, logger } = await build()
        meta.pageInsights.mockRejectedValueOnce(new Error("Meta down"))

        const report = await service.postWeekly("person-1", "ws-1", "vi")

        expect(members.require).toHaveBeenCalledWith("person-1", "ws-1", ["owner", "manager"])
        expect(logger.error).toHaveBeenCalled()
        expect(cards.emit).toHaveBeenCalledWith(
            { workspaceId: "ws-1", locale: "vi" },
            { kind: "weekly_report", workItemId: null, report },
        )
    })
})
