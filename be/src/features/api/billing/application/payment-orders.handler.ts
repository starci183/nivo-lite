import { QueryHandler } from "@nestjs/cqrs"
import { BillingReadService } from "@modules/domain/billing"
import type { BillingPaymentOrder } from "@modules/domain/billing"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PaymentOrdersQuery } from "./payment-orders.query"

@QueryHandler(PaymentOrdersQuery)
/** Reads authorized payment-orders through the billing capability. */
export class PaymentOrdersHandler extends ICQRSHandler<PaymentOrdersQuery, ReadonlyArray<BillingPaymentOrder>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly billing: BillingReadService,
    ) {
        super(logger)
    }

    protected override process(query: PaymentOrdersQuery): Promise<ReadonlyArray<BillingPaymentOrder>> {
        return this.billing.paymentOrders(query.params.principal.id, query.params.request.workspaceId)
    }
}
