import { Injectable } from "@nestjs/common"
import { ConnectionsService } from "@modules/domain/connections"
import { ContentEngagementDailyService } from "@modules/domain/content-engagement-daily"
import { parseMetaSecret } from "@modules/domain/meta-connections"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectMetaClient } from "@modules/integrations/meta"
import type { MetaClient } from "@modules/integrations/meta"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { Locale } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { MarketingWeeklyReport } from "./content-agent.contracts"
import { ContentAgentLogEvent } from "./content-agent.log-events"
import { MarketingCardsService } from "./marketing-cards.service"
import { lastWeekStart, weekBounds, weeklyReportOf } from "./weekly-report.policy"

const DAY_MS = 86_400_000
/** How many days back one sync reads: the last two weeks the report compares. */
const SYNC_DAYS = 15

const dayText = (time: number): string => new Date(time).toISOString().slice(0, 10)

@Injectable()
/**
 * Performance of AI Marketing: the daily Page insights of Meta are upserted into `content_engagement_daily`; the weekly report
 * compares the last complete week with the week before and is posted as a `weekly_report` card and shown on the "Performance" tab.
 */
export class MarketingInsightsService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        @InjectMetaClient() private readonly meta: MetaClient,
        private readonly connections: ConnectionsService,
        private readonly members: WorkspaceMembersService,
        private readonly cards: MarketingCardsService,
        private readonly daily: ContentEngagementDailyService,
    ) {}

    /** Reads the last fifteen days of the workspace's Page insights into the daily table; answers how many days were stored. */
    async sync(workspaceId: string): Promise<number> {
        const [connection] = await this.connections.listByProvider(workspaceId, "meta", { includeDisconnected: false })
        if (connection === undefined) return 0
        const sealed = await this.connections.readSecret(connection.id)
        const secret = parseMetaSecret(sealed?.plain ?? "{}")
        if (secret.pageId === undefined || secret.pageToken === undefined) return 0
        const today = this.clock.now().getTime()
        const days = await this.meta.pageInsights(
            { pageId: secret.pageId, pageToken: secret.pageToken },
            dayText(today - SYNC_DAYS * DAY_MS),
            dayText(today),
        )
        return this.daily.upsert(workspaceId, "facebook", days)
    }

    /** The report of a week (the last complete one when `weekStart` is empty) for a member of the workspace. */
    async report(principalId: string, workspaceId: string, weekStart: string): Promise<MarketingWeeklyReport> {
        await this.members.require(principalId, workspaceId)
        return this.reportOf(workspaceId, weekStart === "" ? lastWeekStart(this.clock.now()) : weekStart)
    }

    /** Syncs (a failed sync is logged and the stored days are used), then posts the last complete week as a `weekly_report` card. */
    async postWeekly(principalId: string, workspaceId: string, locale: Locale): Promise<MarketingWeeklyReport> {
        await this.members.require(principalId, workspaceId, ["owner", "manager"])
        await this.sync(workspaceId).catch((cause: unknown) => {
            this.logger.error(ContentAgentLogEvent.InsightsFailed, cause, { workspaceId })
        })
        const report = await this.reportOf(workspaceId, lastWeekStart(this.clock.now()))
        await this.cards.emit({ workspaceId, locale }, { kind: "weekly_report", workItemId: null, report })
        return report
    }

    private async reportOf(workspaceId: string, weekStart: string): Promise<MarketingWeeklyReport> {
        const bounds = weekBounds(weekStart)
        return weeklyReportOf(weekStart, await this.daily.between(workspaceId, bounds.previousStart, bounds.nextStart))
    }
}
