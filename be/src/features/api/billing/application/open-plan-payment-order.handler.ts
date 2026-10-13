import { QueryHandler } from "@nestjs/cqrs"
import { BillingReadService } from "@modules/domain/billing"
import type { BillingPaymentOrderLookup } from "@modules/domain/billing"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { OpenPlanPaymentOrderQuery } from "./open-plan-payment-order.query"

@QueryHandler(OpenPlanPaymentOrderQuery)
/** Reads authorized open-plan-payment-order through the billing capability. */
export class OpenPlanPaymentOrderHandler extends ICQRSHandler<OpenPlanPaymentOrderQuery, BillingPaymentOrderLookup> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly billing: BillingReadService,
    ) {
        super(logger)
    }

    protected override process(query: OpenPlanPaymentOrderQuery): Promise<BillingPaymentOrderLookup> {
        return this.billing.openPlanPaymentOrder(query.params.principal.id, query.params.request.workspaceId)
    }
}
