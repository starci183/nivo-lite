import { CommandHandler } from "@nestjs/cqrs"
import { MarketingInsightsService } from "@modules/domain/content-ai"
import type { MarketingWeeklyReport } from "@modules/domain/content-ai"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PostMarketingReportCommand } from "./post-marketing-report.command"

@CommandHandler(PostMarketingReportCommand)
/** Syncs insights and posts the weekly report card. */
export class PostMarketingReportHandler extends ICQRSHandler<PostMarketingReportCommand, MarketingWeeklyReport> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly insights: MarketingInsightsService,
    ) {
        super(logger)
    }

    protected override process(command: PostMarketingReportCommand): Promise<MarketingWeeklyReport> {
        return this.insights.postWeekly(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.locale,
        )
    }
}
