import { Query } from "@nestjs/cqrs"
import type { BillingPaymentOrderLookup } from "@modules/domain/billing"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { OpenPlanPaymentOrderRequest } from "./open-plan-payment-order.contracts"

/** Asks for openPlanPaymentOrder using the verified caller. */
export class OpenPlanPaymentOrderQuery extends Query<BillingPaymentOrderLookup> {
    constructor(readonly params: ExecuteParams<OpenPlanPaymentOrderRequest>) {
        super()
    }
}
