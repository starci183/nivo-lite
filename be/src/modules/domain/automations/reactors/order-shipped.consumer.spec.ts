import { mock } from "@starci/jest-preset"
import { OrderShippedEvent } from "@modules/events/api"
import type { EventDelivery } from "@modules/platform/event-bus"
import type { AutomationReactionsService } from "../automation-reactions.service"
import { OrderShippedConsumer } from "./order-shipped.consumer"

const deliveryOf = (): EventDelivery<OrderShippedEvent> =>
    ({
        correlationId: "corr-1",
        eventId: "evt-1",
        consumer: "order-shipped",
        dedupeKey: "key-1",
        event: { eventId: "evt-1" },
        attempt: 2,
    }) as EventDelivery<OrderShippedEvent>

describe("OrderShippedConsumer", () => {
    it("listens to OrderShippedEvent", () => {
        const subject = new OrderShippedConsumer(mock<AutomationReactionsService>())

        expect(subject.event).toBe(OrderShippedEvent)
    })

    it("hands the delivery itself to onOrderShipped and resolves with its result", async () => {
        const reactions = mock<AutomationReactionsService>()
        reactions.onOrderShipped.mockResolvedValue(undefined)
        const delivery = deliveryOf()

        await expect(new OrderShippedConsumer(reactions).handle(delivery)).resolves.toBeUndefined()

        expect(reactions.onOrderShipped).toHaveBeenCalledTimes(1)
        expect(reactions.onOrderShipped).toHaveBeenCalledWith(delivery)
    })

    it("lets a failure of onOrderShipped reach the bus so the message reappears", async () => {
        const reactions = mock<AutomationReactionsService>()
        reactions.onOrderShipped.mockRejectedValue(new Error("boom"))

        await expect(new OrderShippedConsumer(reactions).handle(deliveryOf())).rejects.toThrow("boom")
    })
})
