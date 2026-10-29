import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { PaymentReconciledEvent } from "@modules/events/api"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { SendPaymentReceiptCommand } from "../../application/send-payment-receipt.command"

@Injectable()
/** The consumer door of the payment_reconciled event in the payment-receipts reactor: it dispatches one command and forwards the event id. */
export class PaymentReconciledConsumer implements EventConsumer<PaymentReconciledEvent> {
    readonly event = PaymentReconciledEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Delivery is at least once: the domain service the command reaches claims the delivery in the inbox inside its own transaction. */
    async handle(delivery: EventDelivery<PaymentReconciledEvent>): Promise<void> {
        await this.commandBus.execute(
            new SendPaymentReceiptCommand({
                request: { eventId: delivery.eventId, delivery, correlationId: delivery.correlationId },
            }),
        )
    }
}
