import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import {
    BOOKING_STATUS_CHANGED_BOOKING_EFFECTS_TOPIC_QUEUE,
    InjectEventConsumerRegistry,
} from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { BookingEffectsModule } from "../../booking-effects.module"
import { BookingStatusChangedConsumer } from "./booking_status_changed.consumer"
import { ConfigurableModuleClass } from "./booking-effects-message.module-definition"

@Module({ imports: [BookingEffectsModule.register({})], providers: [BookingStatusChangedConsumer] })
/** The message transport of the booking-effects reactor: subscribes its consumers to their queues; the api app composes it. */
export class BookingEffectsMessageModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly bookingStatusChangedConsumer: BookingStatusChangedConsumer,
    ) {
        super()
    }

    /** The subscriptions are static: one literal queue constant per consumer. */
    onModuleInit(): void {
        this.consumers.subscribe(BOOKING_STATUS_CHANGED_BOOKING_EFFECTS_TOPIC_QUEUE, this.bookingStatusChangedConsumer)
    }
}
