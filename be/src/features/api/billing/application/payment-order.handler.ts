import { QueryHandler } from "@nestjs/cqrs"
import { BillingReadService } from "@modules/domain/billing"
import type { BillingPaymentOrderLookup } from "@modules/domain/billing"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PaymentOrderQuery } from "./payment-order.query"

@QueryHandler(PaymentOrderQuery)
/** Reads authorized payment-order through the billing capability. */
export class PaymentOrderHandler extends ICQRSHandler<PaymentOrderQuery, BillingPaymentOrderLookup> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly billing: BillingReadService,
    ) {
        super(logger)
    }

    protected override process(query: PaymentOrderQuery): Promise<BillingPaymentOrderLookup> {
        return this.billing.paymentOrder(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.id,
        )
    }
}
