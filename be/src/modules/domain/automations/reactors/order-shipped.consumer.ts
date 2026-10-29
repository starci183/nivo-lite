import { Injectable } from "@nestjs/common"
import { OrderShippedEvent } from "@modules/events/api"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { AutomationReactionsService } from "../automation-reactions.service"

@Injectable()
/** The thin door of the automations reactor of `order_shipped`: it hands each delivery to one command. */
export class OrderShippedConsumer implements EventConsumer<OrderShippedEvent> {
    readonly event = OrderShippedEvent

    constructor(private readonly reactions: AutomationReactionsService) {}

    /** Dispatches the delivery; a throw leaves the message to reappear after its visibility timeout. */
    handle(delivery: EventDelivery<OrderShippedEvent>): Promise<void> {
        return this.reactions.onOrderShipped(delivery)
    }
}
