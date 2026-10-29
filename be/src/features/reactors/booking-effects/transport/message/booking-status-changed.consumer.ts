import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { BookingStatusChangedEvent } from "@modules/events/api"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { ApplyBookingEffectsCommand } from "../../application/apply-booking-effects.command"

@Injectable()
/** The consumer door of the booking_status_changed event in the booking-effects reactor: it dispatches one command and forwards the event id. */
export class BookingStatusChangedConsumer implements EventConsumer<BookingStatusChangedEvent> {
    readonly event = BookingStatusChangedEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Delivery is at least once: the domain service the command reaches claims the delivery in the inbox inside its own transaction. */
    async handle(delivery: EventDelivery<BookingStatusChangedEvent>): Promise<void> {
        await this.commandBus.execute(
            new ApplyBookingEffectsCommand({
                request: { eventId: delivery.eventId, delivery, correlationId: delivery.correlationId },
            }),
        )
    }
}
