import { QueryHandler } from "@nestjs/cqrs"
import { UsageService } from "@modules/domain/usage"
import type { UsageSummary } from "@modules/domain/usage"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetUsageSummaryQuery } from "./get-usage-summary.query"

@QueryHandler(GetUsageSummaryQuery)
/** Answers the usage summary from the usage service, which admits owner and manager only. */
export class GetUsageSummaryHandler extends ICQRSHandler<GetUsageSummaryQuery, UsageSummary> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly usage: UsageService,
    ) {
        super(logger)
    }

    protected override process(query: GetUsageSummaryQuery): Promise<UsageSummary> {
        return this.usage.summaryForManager(query.params.principal.id, query.params.request.workspaceId)
    }
}
