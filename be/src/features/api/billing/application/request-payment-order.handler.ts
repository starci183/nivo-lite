import { CommandHandler } from "@nestjs/cqrs"
import { PaymentOrderRequestsService } from "@modules/domain/payment-order-requests"
import type { QueuedPaymentOrderRequest } from "@modules/domain/payment-order-requests"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RequestPaymentOrderCommand } from "./request-payment-order.command"

@CommandHandler(RequestPaymentOrderCommand)
/** Enqueues the manager's request through the payment-order-requests capability. */
export class RequestPaymentOrderHandler extends ICQRSHandler<RequestPaymentOrderCommand, QueuedPaymentOrderRequest> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly requests: PaymentOrderRequestsService,
    ) {
        super(logger)
    }

    protected override process(command: RequestPaymentOrderCommand): Promise<QueuedPaymentOrderRequest> {
        return this.requests.request(command.params.principal.id, command.params.request)
    }
}
