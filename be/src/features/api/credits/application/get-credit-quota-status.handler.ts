import { QueryHandler } from "@nestjs/cqrs"
import { AiUsageOverviewService } from "@modules/domain/ai-usage-events"
import type { QuotaLookup } from "@modules/domain/ai-usage-events"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetCreditQuotaStatusQuery } from "./get-credit-quota-status.query"

@QueryHandler(GetCreditQuotaStatusQuery)
/** Answers get credit quota status through the existing domain capability. */
export class GetCreditQuotaStatusHandler extends ICQRSHandler<GetCreditQuotaStatusQuery, QuotaLookup> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly usage: AiUsageOverviewService,
    ) {
        super(logger)
    }

    protected override process(query: GetCreditQuotaStatusQuery): Promise<QuotaLookup> {
        return this.usage.quotaStatus(query.params.principal.id, query.params.request.workspaceId)
    }
}
