import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { OrderShippedEvent } from "@modules/events/api"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { ReactToOrderShippedCommand } from "../../application/react-to-order-shipped.command"

@Injectable()
/** The consumer door of the order_shipped event in the automation-triggers reactor: it dispatches one command and forwards the event id. */
export class OrderShippedConsumer implements EventConsumer<OrderShippedEvent> {
    readonly event = OrderShippedEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Delivery is at least once: the domain service the command reaches claims the delivery in the inbox inside its own transaction. */
    async handle(delivery: EventDelivery<OrderShippedEvent>): Promise<void> {
        await this.commandBus.execute(
            new ReactToOrderShippedCommand({
                request: { eventId: delivery.eventId, delivery, correlationId: delivery.correlationId },
            }),
        )
    }
}
