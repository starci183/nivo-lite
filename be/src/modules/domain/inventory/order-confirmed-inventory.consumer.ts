import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { OrderConfirmedEvent } from "@modules/events/api"
import { InjectEventConsumerRegistry, ORDER_CONFIRMED_INVENTORY_TOPIC_QUEUE } from "@modules/platform/event-bus"
import type { EventConsumer, EventConsumerRegistry, EventDelivery } from "@modules/platform/event-bus"
import { InventoryDeductionService } from "./inventory-deduction.service"

@Injectable()
/** The `inventory` reactor of `order_confirmed`: a thin door that hands a confirmed order to the stock deduction. */
export class OrderConfirmedInventoryConsumer implements EventConsumer<OrderConfirmedEvent>, OnModuleInit {
    readonly event = OrderConfirmedEvent

    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly deduction: InventoryDeductionService,
    ) {}

    /** Subscribes this door to its queue; reading starts when the app has bootstrapped. */
    onModuleInit(): void {
        this.consumers.subscribe(ORDER_CONFIRMED_INVENTORY_TOPIC_QUEUE, this)
    }

    /** Applies one delivery. */
    handle(delivery: EventDelivery<OrderConfirmedEvent>): Promise<void> {
        const { workspaceId, orderId, orderNo, items } = delivery.event.payload
        return this.deduction.deductConfirmedOrder(delivery.consumer, delivery.dedupeKey, {
            workspaceId,
            orderId,
            orderNo,
            items,
        })
    }
}
