import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { ContentEngagementDailyService } from "@modules/domain/content-engagement-daily"
import { ContentWeeklyReportsService } from "@modules/domain/content-weekly-reports"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MarketingCardsService } from "./marketing-cards.service"
import { MarketingChannelsService } from "./marketing-channels.service"
import { MarketingInsightsService } from "./marketing-insights.service"
import { MarketingSuggestionService } from "./marketing-suggestion.service"

// Tuesday 2026-10-20 14:00 in Vietnam: the last complete week starts Monday the 12th.
const NOW = "2026-10-20T07:00:00.000Z"
const DAYS = [
    { channel: "facebook", day: "2026-10-12", reach: 100, engagements: 10, messages: 2 },
    { channel: "facebook", day: "2026-10-06", reach: 50, engagements: 5, messages: 1 },
]
const POSTS = [
    {
        id: "PAGE_1",
        channel: "facebook",
        message: "Relax at HAKUEN",
        publishedAt: "2026-10-18T02:00:00.000Z",
        engagements: 356,
        href: "https://facebook.com/1",
    },
]
const SUGGESTION = {
    title: "Facebook led",
    body: "Post two videos.",
    sources: [{ layer: 1, kind: "connector", ref: "meta.page_insights", label: "facebook" }],
}
const RANKED = {
    id: "PAGE_1",
    channel: "facebook",
    title: "Relax at HAKUEN",
    publishedAt: "2026-10-18T02:00:00.000Z",
    engagements: 356,
    href: "https://facebook.com/1",
}

const build = async (now = NOW) => {
    const members = mock<WorkspaceMembersService>()
    const cards = mock<MarketingCardsService>()
    const daily = mock<ContentEngagementDailyService>()
    const logger = mock<Logger>()
    const suggestions = mock<MarketingSuggestionService>()
    const reports = mock<ContentWeeklyReportsService>()
    const channels = mock<MarketingChannelsService>()
    suggestions.suggest.mockResolvedValue(SUGGESTION)
    daily.between.mockResolvedValue(DAYS)
    reports.find.mockResolvedValue(null)
    reports.claimPost.mockResolvedValue(true)
    channels.postsOf.mockResolvedValue(POSTS)
    channels.sync.mockResolvedValue(2)
    channels.isConnected.mockResolvedValue(true)
    const moduleRef = await Test.createTestingModule({
        providers: [
            MarketingInsightsService,
            { provide: CLOCK, useValue: new FakeClock(now) },
            { provide: LOGGER, useValue: logger },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: MarketingCardsService, useValue: cards },
            { provide: ContentEngagementDailyService, useValue: daily },
            { provide: MarketingSuggestionService, useValue: suggestions },
            { provide: ContentWeeklyReportsService, useValue: reports },
            { provide: MarketingChannelsService, useValue: channels },
        ],
    }).compile()
    const service = moduleRef.get(MarketingInsightsService)
    return { service, members, cards, daily, logger, suggestions, reports, channels }
}

describe("MarketingInsightsService report", () => {
    it("computes the last complete week for a member with its top posts and suggestion, and stores them", async () => {
        const { service, members, daily, channels, suggestions, reports } = await build()

        const report = await service.report("person-1", "ws-1", "", "en")

        expect(members.require).toHaveBeenCalledWith("person-1", "ws-1")
        expect(report.weekStart).toBe("2026-10-12")
        expect(report.engagements).toEqual({ value: 10, previous: 5, changePct: 100 })
        expect(daily.between).toHaveBeenCalledWith("ws-1", "2026-10-05", "2026-10-19")
        expect(channels.postsOf).toHaveBeenCalledWith("ws-1", "2026-10-12", "2026-10-19")
        expect(report.posts).toEqual([RANKED])
        expect(report.postCount).toBe(1)
        expect(report.suggestion).toEqual(SUGGESTION)
        expect(suggestions.suggest).toHaveBeenCalledWith("ws-1", "en", { ...report, suggestion: null })
        expect(reports.store).toHaveBeenCalledWith(
            "ws-1",
            "2026-10-12",
            { posts: [RANKED], postCount: 1, suggestion: SUGGESTION },
            NOW,
        )
    })

    it("shows a week from the store without calling the channels or the model while it is fresh", async () => {
        const { service, reports, channels, suggestions } = await build()
        reports.find.mockResolvedValue({
            posts: [RANKED],
            postCount: 8,
            suggestion: null,
            computedAt: "2026-10-19T01:00:00.000Z",
            postedAt: null,
        })

        const report = await service.report("person-1", "ws-1", "2026-10-12", "vi")

        expect(report).toMatchObject({ posts: [RANKED], postCount: 8, suggestion: null })
        expect(report.engagements.value).toBe(10)
        expect(channels.postsOf).not.toHaveBeenCalled()
        expect(suggestions.suggest).not.toHaveBeenCalled()
        expect(reports.store).not.toHaveBeenCalled()
    })

    it("computes a stored week again when its extras are stale", async () => {
        const { service, reports, channels } = await build()
        reports.find.mockResolvedValue({
            posts: [],
            postCount: 0,
            suggestion: null,
            computedAt: "2026-10-18T10:00:00.000Z",
            postedAt: null,
        })

        await expect(service.report("person-1", "ws-1", "2026-10-12", "vi")).resolves.toMatchObject({ postCount: 1 })
        expect(channels.postsOf).toHaveBeenCalled()
    })
})

describe("MarketingInsightsService postWeekly", () => {
    it("claims the week, syncs, and posts the report card, logging a failed sync", async () => {
        const { service, cards, members, logger, channels, reports } = await build()
        channels.sync.mockRejectedValueOnce(new Error("Meta down"))

        const report = await service.postWeekly("person-1", "ws-1", "vi")

        expect(members.require).toHaveBeenCalledWith("person-1", "ws-1", ["owner", "manager"])
        expect(reports.claimPost).toHaveBeenCalledWith("ws-1", "2026-10-12", NOW)
        expect(logger.error).toHaveBeenCalledWith("marketing.insights.failed", new Error("Meta down"), {
            workspaceId: "ws-1",
        })
        expect(cards.emit).toHaveBeenCalledWith(
            { workspaceId: "ws-1", locale: "vi" },
            { kind: "weekly_report", workItemId: null, report },
        )
    })
})

describe("MarketingInsightsService postWeeklyDue", () => {
    it("posts last week's card once from Monday 08:00 for a workspace with a connected channel", async () => {
        // Monday 2026-10-19 08:00 in Vietnam.
        const { service, cards, reports, channels } = await build("2026-10-19T01:00:00.000Z")

        await expect(service.postWeeklyDue("ws-1")).resolves.toBe(true)

        expect(channels.isConnected).toHaveBeenCalledWith("ws-1")
        expect(reports.claimPost).toHaveBeenCalledWith("ws-1", "2026-10-12", "2026-10-19T01:00:00.000Z")
        expect(channels.sync).toHaveBeenCalledWith("ws-1")
        expect(cards.emit).toHaveBeenCalledWith(
            { workspaceId: "ws-1", locale: "vi" },
            expect.objectContaining({ kind: "weekly_report" }),
        )
    })

    it("waits until Monday 08:00", async () => {
        // Monday 2026-10-19 07:59 in Vietnam.
        const { service, channels, cards } = await build("2026-10-19T00:59:00.000Z")

        await expect(service.postWeeklyDue("ws-1")).resolves.toBe(false)
        expect(channels.isConnected).not.toHaveBeenCalled()
        expect(cards.emit).not.toHaveBeenCalled()
    })

    it("posts nothing for a workspace with no connected channel, or a week already posted", async () => {
        const { service, channels, reports, cards } = await build()
        channels.isConnected.mockResolvedValueOnce(false)

        await expect(service.postWeeklyDue("ws-1")).resolves.toBe(false)
        expect(reports.claimPost).not.toHaveBeenCalled()

        reports.claimPost.mockResolvedValueOnce(false)
        await expect(service.postWeeklyDue("ws-1")).resolves.toBe(false)
        expect(cards.emit).not.toHaveBeenCalled()
    })
})
