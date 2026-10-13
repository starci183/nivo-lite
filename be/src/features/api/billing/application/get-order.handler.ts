import { QueryHandler } from "@nestjs/cqrs"
import { BillingService } from "@modules/domain/billing"
import type { PayableOrder } from "@modules/domain/billing"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetOrderQuery } from "./get-order.query"

@QueryHandler(GetOrderQuery)
/** Answers one payment order from the billing service, which admits members of the workspace only. */
export class GetOrderHandler extends ICQRSHandler<GetOrderQuery, PayableOrder> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly billing: BillingService,
    ) {
        super(logger)
    }

    protected override process(query: GetOrderQuery): Promise<PayableOrder> {
        return this.billing.getOrder(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.orderId,
        )
    }
}
