import { Injectable } from "@nestjs/common"
import { PAYMENT_ORDER_REQUEST_QUEUE, PaymentOrderRequestsService } from "@modules/domain/payment-order-requests"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import type { QueueDelivery } from "@modules/platform/queue"
import { PlaceOrderStep } from "../../steps/place-order.step"

@Injectable()
/** The processor of the create-payment-order job: the runner claims and settles it; `process` delegates the fenced claim to the one step. */
export class CreatePaymentOrderProcessor extends FencedProcessor {
    readonly queue = PAYMENT_ORDER_REQUEST_QUEUE

    constructor(
        private readonly placeOrder: PlaceOrderStep,
        private readonly requests: PaymentOrderRequestsService,
    ) {
        super()
    }

    /** Makes the order; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.placeOrder.run(job)
    }

    /** Publishes a terminal request failure when the queue will no longer retry this delivery. */
    override onFailed(delivery: QueueDelivery, cause: unknown): Promise<void> {
        return this.requests.fail(delivery.payload, cause)
    }
}
