import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { OrderConfirmedEvent } from "@modules/events/api"
import { EVENT_CONSUMER_REGISTRY, ORDER_CONFIRMED_INVENTORY_TOPIC_QUEUE } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { InventoryDeductionService } from "./inventory-deduction.service"
import { OrderConfirmedInventoryConsumer } from "./order-confirmed-inventory.consumer"

const build = async () => {
    const registry = mock<EventConsumerRegistry>()
    const deduction = mock<InventoryDeductionService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            OrderConfirmedInventoryConsumer,
            { provide: EVENT_CONSUMER_REGISTRY, useValue: registry },
            { provide: InventoryDeductionService, useValue: deduction },
        ],
    }).compile()
    return { consumer: moduleRef.get(OrderConfirmedInventoryConsumer), registry, deduction }
}

describe("OrderConfirmedInventoryConsumer", () => {
    it("subscribes itself to the inventory queue of order_confirmed", async () => {
        const { consumer, registry } = await build()

        consumer.onModuleInit()

        expect(registry.subscribe).toHaveBeenCalledWith(ORDER_CONFIRMED_INVENTORY_TOPIC_QUEUE, consumer)
        expect(consumer.event).toBe(OrderConfirmedEvent)
    })

    it("hands the order of a delivery to the stock deduction under its delivery key", async () => {
        const { consumer, deduction } = await build()
        const event = OrderConfirmedEvent.create({
            workspaceId: "ws-1",
            orderId: "ord-1",
            orderNo: "SO-1",
            leadId: "lead-1",
            customer: "Lan",
            items: "2 tea",
            amountVnd: 300000,
            channel: "Zalo",
            confirmedBy: "Mai",
        })

        await consumer.handle({
            correlationId: "c-1",
            eventId: event.eventId,
            consumer: ORDER_CONFIRMED_INVENTORY_TOPIC_QUEUE,
            dedupeKey: "ord-1",
            event,
            attempt: 1,
        })

        expect(deduction.deductConfirmedOrder).toHaveBeenCalledWith(ORDER_CONFIRMED_INVENTORY_TOPIC_QUEUE, "ord-1", {
            workspaceId: "ws-1",
            orderId: "ord-1",
            orderNo: "SO-1",
            items: "2 tea",
        })
    })
})
