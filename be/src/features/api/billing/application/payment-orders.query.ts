import { Query } from "@nestjs/cqrs"
import type { BillingPaymentOrder } from "@modules/domain/billing"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { PaymentOrdersRequest } from "./payment-orders.contracts"

/** Asks for paymentOrders using the verified caller. */
export class PaymentOrdersQuery extends Query<ReadonlyArray<BillingPaymentOrder>> {
    constructor(readonly params: ExecuteParams<PaymentOrdersRequest>) {
        super()
    }
}
