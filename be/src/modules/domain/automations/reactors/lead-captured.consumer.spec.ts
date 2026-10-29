import { mock } from "@starci/jest-preset"
import { LeadCapturedEvent } from "@modules/events/api"
import type { EventDelivery } from "@modules/platform/event-bus"
import type { AutomationReactionsService } from "../automation-reactions.service"
import { LeadCapturedConsumer } from "./lead-captured.consumer"

const deliveryOf = (): EventDelivery<LeadCapturedEvent> =>
    ({
        correlationId: "corr-1",
        eventId: "evt-1",
        consumer: "lead-captured",
        dedupeKey: "key-1",
        event: { eventId: "evt-1" },
        attempt: 2,
    }) as EventDelivery<LeadCapturedEvent>

describe("LeadCapturedConsumer", () => {
    it("listens to LeadCapturedEvent", () => {
        const subject = new LeadCapturedConsumer(mock<AutomationReactionsService>())

        expect(subject.event).toBe(LeadCapturedEvent)
    })

    it("hands the delivery itself to onLeadCaptured and resolves with its result", async () => {
        const reactions = mock<AutomationReactionsService>()
        reactions.onLeadCaptured.mockResolvedValue(undefined)
        const delivery = deliveryOf()

        await expect(new LeadCapturedConsumer(reactions).handle(delivery)).resolves.toBeUndefined()

        expect(reactions.onLeadCaptured).toHaveBeenCalledTimes(1)
        expect(reactions.onLeadCaptured).toHaveBeenCalledWith(delivery)
    })

    it("lets a failure of onLeadCaptured reach the bus so the message reappears", async () => {
        const reactions = mock<AutomationReactionsService>()
        reactions.onLeadCaptured.mockRejectedValue(new Error("boom"))

        await expect(new LeadCapturedConsumer(reactions).handle(deliveryOf())).rejects.toThrow("boom")
    })
})
