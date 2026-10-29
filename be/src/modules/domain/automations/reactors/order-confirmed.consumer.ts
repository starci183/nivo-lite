import { Injectable } from "@nestjs/common"
import { OrderConfirmedEvent } from "@modules/events/api"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { AutomationReactionsService } from "../automation-reactions.service"

@Injectable()
/** The thin door of the automations reactor of `order_confirmed`: it hands each delivery to one command. */
export class OrderConfirmedConsumer implements EventConsumer<OrderConfirmedEvent> {
    readonly event = OrderConfirmedEvent

    constructor(private readonly reactions: AutomationReactionsService) {}

    /** Dispatches the delivery; a throw leaves the message to reappear after its visibility timeout. */
    handle(delivery: EventDelivery<OrderConfirmedEvent>): Promise<void> {
        return this.reactions.onOrderConfirmed(delivery)
    }
}
