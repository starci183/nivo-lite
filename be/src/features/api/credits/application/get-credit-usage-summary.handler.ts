import { QueryHandler } from "@nestjs/cqrs"
import { AiUsageOverviewService } from "@modules/domain/ai-usage-events"
import type { UsageSummary } from "@modules/domain/ai-usage-events"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetCreditUsageSummaryQuery } from "./get-credit-usage-summary.query"

@QueryHandler(GetCreditUsageSummaryQuery)
/** Answers get credit usage summary through the existing domain capability. */
export class GetCreditUsageSummaryHandler extends ICQRSHandler<GetCreditUsageSummaryQuery, UsageSummary> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly usage: AiUsageOverviewService,
    ) {
        super(logger)
    }

    protected override process(query: GetCreditUsageSummaryQuery): Promise<UsageSummary> {
        return this.usage.usageSummary(query.params.principal.id, query.params.request.workspaceId)
    }
}
