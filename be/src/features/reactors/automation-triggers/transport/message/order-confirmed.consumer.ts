import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { OrderConfirmedEvent } from "@modules/events/api"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { ReactToOrderConfirmedCommand } from "../../application/react-to-order-confirmed.command"

@Injectable()
/** The consumer door of the order_confirmed event in the automation-triggers reactor: it dispatches one command and forwards the event id. */
export class OrderConfirmedConsumer implements EventConsumer<OrderConfirmedEvent> {
    readonly event = OrderConfirmedEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Delivery is at least once: the domain service the command reaches claims the delivery in the inbox inside its own transaction. */
    async handle(delivery: EventDelivery<OrderConfirmedEvent>): Promise<void> {
        await this.commandBus.execute(
            new ReactToOrderConfirmedCommand({
                request: { eventId: delivery.eventId, delivery, correlationId: delivery.correlationId },
            }),
        )
    }
}
