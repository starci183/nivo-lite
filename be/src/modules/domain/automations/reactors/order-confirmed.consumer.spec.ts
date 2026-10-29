import { mock } from "@starci/jest-preset"
import { OrderConfirmedEvent } from "@modules/events/api"
import type { EventDelivery } from "@modules/platform/event-bus"
import type { AutomationReactionsService } from "../automation-reactions.service"
import { OrderConfirmedConsumer } from "./order-confirmed.consumer"

const deliveryOf = (): EventDelivery<OrderConfirmedEvent> =>
    ({
        correlationId: "corr-1",
        eventId: "evt-1",
        consumer: "order-confirmed",
        dedupeKey: "key-1",
        event: { eventId: "evt-1" },
        attempt: 2,
    }) as EventDelivery<OrderConfirmedEvent>

describe("OrderConfirmedConsumer", () => {
    it("listens to OrderConfirmedEvent", () => {
        const subject = new OrderConfirmedConsumer(mock<AutomationReactionsService>())

        expect(subject.event).toBe(OrderConfirmedEvent)
    })

    it("hands the delivery itself to onOrderConfirmed and resolves with its result", async () => {
        const reactions = mock<AutomationReactionsService>()
        reactions.onOrderConfirmed.mockResolvedValue(undefined)
        const delivery = deliveryOf()

        await expect(new OrderConfirmedConsumer(reactions).handle(delivery)).resolves.toBeUndefined()

        expect(reactions.onOrderConfirmed).toHaveBeenCalledTimes(1)
        expect(reactions.onOrderConfirmed).toHaveBeenCalledWith(delivery)
    })

    it("lets a failure of onOrderConfirmed reach the bus so the message reappears", async () => {
        const reactions = mock<AutomationReactionsService>()
        reactions.onOrderConfirmed.mockRejectedValue(new Error("boom"))

        await expect(new OrderConfirmedConsumer(reactions).handle(deliveryOf())).rejects.toThrow("boom")
    })
})
