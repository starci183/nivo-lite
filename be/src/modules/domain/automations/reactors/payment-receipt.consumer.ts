import { Injectable } from "@nestjs/common"
import { PaymentReconciledEvent } from "@modules/events/api"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { AutomationReactionsService } from "../automation-reactions.service"

@Injectable()
/** The thin door of the automations reactor of `payment_reconciled`, for the customer's receipt email: it hands each delivery to one command. */
export class PaymentReceiptConsumer implements EventConsumer<PaymentReconciledEvent> {
    readonly event = PaymentReconciledEvent

    constructor(private readonly reactions: AutomationReactionsService) {}

    /** Dispatches the delivery; a throw leaves the message to reappear after its visibility timeout. */
    handle(delivery: EventDelivery<PaymentReconciledEvent>): Promise<void> {
        return this.reactions.onPaymentReceipt(delivery)
    }
}
