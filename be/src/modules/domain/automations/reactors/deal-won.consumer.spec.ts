import { mock } from "@starci/jest-preset"
import { DealWonEvent } from "@modules/events/api"
import type { EventDelivery } from "@modules/platform/event-bus"
import type { AutomationReactionsService } from "../automation-reactions.service"
import { DealWonConsumer } from "./deal-won.consumer"

const deliveryOf = (): EventDelivery<DealWonEvent> =>
    ({
        correlationId: "corr-1",
        eventId: "evt-1",
        consumer: "deal-won",
        dedupeKey: "key-1",
        event: { eventId: "evt-1" },
        attempt: 2,
    }) as EventDelivery<DealWonEvent>

describe("DealWonConsumer", () => {
    it("listens to DealWonEvent", () => {
        const subject = new DealWonConsumer(mock<AutomationReactionsService>())

        expect(subject.event).toBe(DealWonEvent)
    })

    it("hands the delivery itself to onDealWon and resolves with its result", async () => {
        const reactions = mock<AutomationReactionsService>()
        reactions.onDealWon.mockResolvedValue(undefined)
        const delivery = deliveryOf()

        await expect(new DealWonConsumer(reactions).handle(delivery)).resolves.toBeUndefined()

        expect(reactions.onDealWon).toHaveBeenCalledTimes(1)
        expect(reactions.onDealWon).toHaveBeenCalledWith(delivery)
    })

    it("lets a failure of onDealWon reach the bus so the message reappears", async () => {
        const reactions = mock<AutomationReactionsService>()
        reactions.onDealWon.mockRejectedValue(new Error("boom"))

        await expect(new DealWonConsumer(reactions).handle(deliveryOf())).rejects.toThrow("boom")
    })
})
