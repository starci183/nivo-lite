import { QueryHandler } from "@nestjs/cqrs"
import { AiUsageOverviewService } from "@modules/domain/ai-usage-events"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetCreditRecentCostUsdQuery } from "./get-credit-recent-cost-usd.query"

@QueryHandler(GetCreditRecentCostUsdQuery)
/** Answers get credit recent cost usd through the existing domain capability. */
export class GetCreditRecentCostUsdHandler extends ICQRSHandler<GetCreditRecentCostUsdQuery, number> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly usage: AiUsageOverviewService,
    ) {
        super(logger)
    }

    protected override process(query: GetCreditRecentCostUsdQuery): Promise<number> {
        return this.usage.recentCostUsd(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.from,
        )
    }
}
