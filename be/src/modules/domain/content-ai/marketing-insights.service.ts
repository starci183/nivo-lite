import { Injectable } from "@nestjs/common"
import { ContentEngagementDailyService } from "@modules/domain/content-engagement-daily"
import { ContentWeeklyReportsService } from "@modules/domain/content-weekly-reports"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { Locale } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { MarketingWeeklyReport } from "./content-agent.contracts"
import { ContentAgentLogEvent } from "./content-agent.log-events"
import { MarketingCardsService } from "./marketing-cards.service"
import { MarketingChannelsService } from "./marketing-channels.service"
import { MarketingSuggestionService } from "./marketing-suggestion.service"
import { isCacheFresh, isWeeklyPostDue, lastWeekStart, weekBounds, weeklyReportOf } from "./weekly-report.policy"

/** The language of a report the weekly job posts: no request names one, so the workspace default. */
const JOB_LOCALE: Locale = "vi"

@Injectable()
/**
 * Performance of AI Marketing. The weekly report compares the last complete week with the week before from the daily channel
 * figures, ranks the posts the channels published in it and carries the model's suggestion; the posts and the suggestion are
 * computed once per week and kept in `content_weekly_reports` (recomputed only while the week is still running). It is shown on
 * the "Performance" tab, posted on demand, and posted by the content tick once per week from Monday 08:00 (Vietnam time).
 */
export class MarketingInsightsService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly members: WorkspaceMembersService,
        private readonly cards: MarketingCardsService,
        private readonly daily: ContentEngagementDailyService,
        private readonly suggestions: MarketingSuggestionService,
        private readonly reports: ContentWeeklyReportsService,
        private readonly channels: MarketingChannelsService,
    ) {}

    /** The report of a week (the last complete one when `weekStart` is empty) for a member of the workspace, advised in `locale`. */
    async report(
        principalId: string,
        workspaceId: string,
        weekStart: string,
        locale: Locale,
    ): Promise<MarketingWeeklyReport> {
        await this.members.require(principalId, workspaceId)
        return this.reportOf(workspaceId, weekStart === "" ? lastWeekStart(this.clock.now()) : weekStart, locale)
    }

    /** Syncs and posts the last complete week as a `weekly_report` card now (an owner or manager asked); the weekly job then skips it. */
    async postWeekly(principalId: string, workspaceId: string, locale: Locale): Promise<MarketingWeeklyReport> {
        await this.members.require(principalId, workspaceId, ["owner", "manager"])
        const now = this.clock.now()
        await this.reports.claimPost(workspaceId, lastWeekStart(now), now.toISOString())
        return this.post(workspaceId, locale)
    }

    /**
     * The weekly job's turn for one workspace: from Monday 08:00, a workspace with a connected channel gets last week's report card
     * once (the claim makes a second tick, or an earlier manual post, skip it). Answers whether a card was posted.
     */
    async postWeeklyDue(workspaceId: string): Promise<boolean> {
        const now = this.clock.now()
        if (!isWeeklyPostDue(now)) return false
        if (!(await this.channels.isConnected(workspaceId))) return false
        if (!(await this.reports.claimPost(workspaceId, lastWeekStart(now), now.toISOString()))) return false
        await this.post(workspaceId, JOB_LOCALE)
        return true
    }

    /** Syncs the channels (a failed sync is logged and the stored days are used) and posts last week's card. */
    private async post(workspaceId: string, locale: Locale): Promise<MarketingWeeklyReport> {
        await this.channels.sync(workspaceId).catch((cause: unknown) => {
            this.logger.error(ContentAgentLogEvent.InsightsFailed, cause, { workspaceId })
        })
        const report = await this.reportOf(workspaceId, lastWeekStart(this.clock.now()), locale)
        await this.cards.emit({ workspaceId, locale }, { kind: "weekly_report", workItemId: null, report })
        return report
    }

    /** The week from the daily figures, with its posts and suggestion from the store while fresh, else computed and stored. */
    private async reportOf(workspaceId: string, weekStart: string, locale: Locale): Promise<MarketingWeeklyReport> {
        const bounds = weekBounds(weekStart)
        const now = this.clock.now()
        const [rows, stored] = await Promise.all([
            this.daily.between(workspaceId, bounds.previousStart, bounds.nextStart),
            this.reports.find(workspaceId, weekStart),
        ])
        if (stored !== null && isCacheFresh(stored.computedAt, bounds.nextStart, now)) {
            const figures = weeklyReportOf(weekStart, rows, [])
            return { ...figures, posts: stored.posts, postCount: stored.postCount, suggestion: stored.suggestion }
        }
        const report = weeklyReportOf(
            weekStart,
            rows,
            await this.channels.postsOf(workspaceId, weekStart, bounds.nextStart),
        )
        const suggestion = await this.suggestions.suggest(workspaceId, locale, report)
        await this.reports.store(
            workspaceId,
            weekStart,
            { posts: report.posts, postCount: report.postCount, suggestion },
            now.toISOString(),
        )
        return { ...report, suggestion }
    }
}
