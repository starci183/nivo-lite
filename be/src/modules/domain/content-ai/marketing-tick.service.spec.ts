import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ContentSettingsService } from "@modules/domain/content-settings"
import type { TickWorkspace } from "@modules/domain/content-settings"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ContentScheduleService } from "./content-schedule.service"
import { MarketingInsightsService } from "./marketing-insights.service"
import { MarketingTickService } from "./marketing-tick.service"

const FIRST = "00000000-0000-0000-0000-000000000000"

const workspace = (workspaceId: string): TickWorkspace => mock<TickWorkspace>({ workspaceId })

const build = async () => {
    const settings = mock<ContentSettingsService>()
    const schedule = mock<ContentScheduleService>()
    const insights = mock<MarketingInsightsService>()
    const logger = mock<Logger>()
    schedule.publishDue.mockResolvedValue(2)
    settings.tickWorkspaces.mockResolvedValue([workspace("ws-1"), workspace("ws-2")])
    insights.postWeeklyDue.mockResolvedValue(true)
    const moduleRef = await Test.createTestingModule({
        providers: [
            MarketingTickService,
            { provide: LOGGER, useValue: logger },
            { provide: ContentSettingsService, useValue: settings },
            { provide: ContentScheduleService, useValue: schedule },
            { provide: MarketingInsightsService, useValue: insights },
        ],
    }).compile()
    return { service: moduleRef.get(MarketingTickService), settings, schedule, insights, logger }
}

describe("MarketingTickService", () => {
    it("publishes the due articles, then posts the due weekly reports of every workspace", async () => {
        const { service, settings, insights } = await build()

        await expect(service.run({})).resolves.toEqual({ published: 2, reports: 2 })

        expect(settings.tickWorkspaces).toHaveBeenCalledWith(FIRST, 100, undefined)
        expect(insights.postWeeklyDue).toHaveBeenCalledWith("ws-1")
        expect(insights.postWeeklyDue).toHaveBeenCalledWith("ws-2")
    })

    it("reads the next page of workspaces after a full one, and only the workspace an operator names", async () => {
        const { service, settings } = await build()
        const full = Array.from({ length: 100 }, (_, index) => workspace(`ws-${index}`))
        settings.tickWorkspaces.mockResolvedValueOnce(full).mockResolvedValueOnce([])

        await expect(service.run({ workspaceId: "ws-9" })).resolves.toEqual({ published: 2, reports: 100 })

        expect(settings.tickWorkspaces).toHaveBeenNthCalledWith(1, FIRST, 100, "ws-9")
        expect(settings.tickWorkspaces).toHaveBeenNthCalledWith(2, "ws-99", 100, "ws-9")
    })

    it("goes on when publishing or one workspace fails, logging each", async () => {
        const { service, schedule, insights, logger } = await build()
        schedule.publishDue.mockRejectedValue(new Error("db down"))
        insights.postWeeklyDue.mockRejectedValueOnce(new Error("Meta down")).mockResolvedValueOnce(false)

        await expect(service.run({})).resolves.toEqual({ published: 0, reports: 0 })

        expect(logger.error).toHaveBeenCalledWith("marketing.tick.failed", new Error("db down"), { step: "publish" })
        expect(logger.error).toHaveBeenCalledWith("marketing.tick.failed", new Error("Meta down"), {
            workspaceId: "ws-1",
        })
    })
})
