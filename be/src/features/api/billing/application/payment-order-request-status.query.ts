import { Query } from "@nestjs/cqrs"
import type { PaymentOrderRequestStatusLookup } from "@modules/domain/payment-order-requests"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { PaymentOrderRequestStatusRequest } from "./payment-order-request-status.contracts"

/** Asks for the authenticated caller's payment-order request progress. */
export class PaymentOrderRequestStatusQuery extends Query<PaymentOrderRequestStatusLookup> {
    constructor(readonly params: ExecuteParams<PaymentOrderRequestStatusRequest>) {
        super()
    }
}
