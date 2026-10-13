import { QueryHandler } from "@nestjs/cqrs"
import { N8nDoorService } from "@modules/domain/n8n-runs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { DaySummary } from "@modules/domain/n8n-runs"
import { FetchDaySummaryQuery } from "./fetch-day-summary.query"

@QueryHandler(FetchDaySummaryQuery)
/** Reads the figures of a day for the daily report workflow. */
export class FetchDaySummaryHandler extends ICQRSHandler<FetchDaySummaryQuery, DaySummary> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly door: N8nDoorService,
    ) {
        super(logger)
    }

    protected override process(message: FetchDaySummaryQuery): Promise<DaySummary> {
        return this.door.daySummary(message.params.request.authorization, message.params.request.date)
    }
}
