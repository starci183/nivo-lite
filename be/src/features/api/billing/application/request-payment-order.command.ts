import { Command } from "@nestjs/cqrs"
import type { PaymentOrderRequestParams, QueuedPaymentOrderRequest } from "@modules/domain/payment-order-requests"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Asks to commit a payment-order request and its durable queue job. */
export class RequestPaymentOrderCommand extends Command<QueuedPaymentOrderRequest> {
    constructor(readonly params: ExecuteParams<PaymentOrderRequestParams>) {
        super()
    }
}
