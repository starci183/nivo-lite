import { QueryHandler } from "@nestjs/cqrs"
import { AiUsageOverviewService } from "@modules/domain/ai-usage-events"
import type { DailyWorkUsage } from "@modules/domain/ai-usage-events"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetCreditWorkUsageQuery } from "./get-credit-work-usage.query"

@QueryHandler(GetCreditWorkUsageQuery)
/** Answers the workspace's AI work per day, module and kind of work (exact credits) to an owner or manager; staff are refused. */
export class GetCreditWorkUsageHandler extends ICQRSHandler<GetCreditWorkUsageQuery, ReadonlyArray<DailyWorkUsage>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly usage: AiUsageOverviewService,
    ) {
        super(logger)
    }

    protected override process(query: GetCreditWorkUsageQuery): Promise<ReadonlyArray<DailyWorkUsage>> {
        const { principal, request } = query.params
        return this.usage.workSummary(principal.id, request.workspaceId, request.days)
    }
}
