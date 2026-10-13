import { QueryHandler } from "@nestjs/cqrs"
import { BillingService } from "@modules/domain/billing"
import type { PayableOrder } from "@modules/domain/billing"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetOpenOrderQuery } from "./get-open-order.query"

@QueryHandler(GetOpenOrderQuery)
/** Answers the open plan order from the billing service, which admits members of the workspace only. */
export class GetOpenOrderHandler extends ICQRSHandler<GetOpenOrderQuery, PayableOrder | null> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly billing: BillingService,
    ) {
        super(logger)
    }

    protected override process(query: GetOpenOrderQuery): Promise<PayableOrder | null> {
        return this.billing.findOpenOrder(query.params.principal.id, query.params.request.workspaceId)
    }
}
