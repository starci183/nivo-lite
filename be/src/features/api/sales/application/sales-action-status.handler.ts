import { QueryHandler } from "@nestjs/cqrs"
import { SalesStatusService } from "@modules/domain/sales"
import type { SalesAction } from "@modules/domain/sales"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SalesActionStatusQuery } from "./sales-action-status.query"

@QueryHandler(SalesActionStatusQuery)
/** Reads the progress of one queued Sales action. */
export class SalesActionStatusHandler extends ICQRSHandler<SalesActionStatusQuery, SalesAction> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sales: SalesStatusService,
    ) {
        super(logger)
    }

    protected override process(query: SalesActionStatusQuery): Promise<SalesAction> {
        return this.sales.status(query.params.principal.id, query.params.request.workspaceId, query.params.request.id)
    }
}
