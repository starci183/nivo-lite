import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { ORDER_CONFIRMED_INVENTORY_TOPIC_QUEUE, InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { InventoryDeductionModule } from "../../inventory-deduction.module"
import { OrderConfirmedConsumer } from "./order-confirmed.consumer"
import { ConfigurableModuleClass } from "./inventory-deduction-message.module-definition"

@Module({ imports: [InventoryDeductionModule.register({})], providers: [OrderConfirmedConsumer] })
/** The message transport of the inventory-deduction reactor: subscribes its consumers to their queues; the api app composes it. */
export class InventoryDeductionMessageModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly orderConfirmedConsumer: OrderConfirmedConsumer,
    ) {
        super()
    }

    /** The subscriptions are static: one literal queue constant per consumer. */
    onModuleInit(): void {
        this.consumers.subscribe(ORDER_CONFIRMED_INVENTORY_TOPIC_QUEUE, this.orderConfirmedConsumer)
    }
}
