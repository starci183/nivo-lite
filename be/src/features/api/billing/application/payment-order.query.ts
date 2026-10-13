import { Query } from "@nestjs/cqrs"
import type { BillingPaymentOrderLookup } from "@modules/domain/billing"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { PaymentOrderRequest } from "./payment-order.contracts"

/** Asks for paymentOrder using the verified caller. */
export class PaymentOrderQuery extends Query<BillingPaymentOrderLookup> {
    constructor(readonly params: ExecuteParams<PaymentOrderRequest>) {
        super()
    }
}
