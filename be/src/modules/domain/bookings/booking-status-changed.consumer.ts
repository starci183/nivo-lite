import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { BookingStatusChangedEvent } from "@modules/events/api"
import {
    BOOKING_STATUS_CHANGED_BOOKING_EFFECTS_TOPIC_QUEUE,
    InjectEventConsumerRegistry,
} from "@modules/platform/event-bus"
import type { EventConsumer, EventConsumerRegistry, EventDelivery } from "@modules/platform/event-bus"
import { BookingEffectsService } from "./booking-effects.service"

@Injectable()
/** The thin door of the `booking_effects` reactor: it reads `booking_status_changed` and has the booking's effects applied with the delivery's key. */
export class BookingStatusChangedConsumer implements EventConsumer<BookingStatusChangedEvent>, OnModuleInit {
    readonly event = BookingStatusChangedEvent

    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly effects: BookingEffectsService,
    ) {}

    /** Subscribes to the reactor's queue. */
    onModuleInit(): void {
        this.consumers.subscribe(BOOKING_STATUS_CHANGED_BOOKING_EFFECTS_TOPIC_QUEUE, this)
    }

    /** Applies the reminders, the fee, the order hand-off, the evidence and the notice of the booking that changed. */
    async handle(delivery: EventDelivery<BookingStatusChangedEvent>): Promise<void> {
        const { workspaceId, bookingId, kind } = delivery.event.payload
        await this.effects.apply(
            { workspaceId, bookingId, kind },
            { consumer: delivery.consumer, dedupeKey: delivery.dedupeKey },
        )
    }
}
