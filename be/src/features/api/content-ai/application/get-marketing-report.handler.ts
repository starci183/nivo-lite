import { QueryHandler } from "@nestjs/cqrs"
import { MarketingInsightsService } from "@modules/domain/content-ai"
import type { MarketingWeeklyReport } from "@modules/domain/content-ai"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetMarketingReportQuery } from "./get-marketing-report.query"

@QueryHandler(GetMarketingReportQuery)
/** Reads the weekly marketing report. */
export class GetMarketingReportHandler extends ICQRSHandler<GetMarketingReportQuery, MarketingWeeklyReport> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly insights: MarketingInsightsService,
    ) {
        super(logger)
    }

    protected override process(command: GetMarketingReportQuery): Promise<MarketingWeeklyReport> {
        return this.insights.report(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.weekStart,
            command.params.request.locale,
        )
    }
}
