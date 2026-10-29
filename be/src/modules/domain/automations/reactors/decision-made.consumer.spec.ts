import { mock } from "@starci/jest-preset"
import { DecisionMadeEvent } from "@modules/events/api"
import type { EventDelivery } from "@modules/platform/event-bus"
import type { AutomationReactionsService } from "../automation-reactions.service"
import { DecisionMadeConsumer } from "./decision-made.consumer"

const deliveryOf = (): EventDelivery<DecisionMadeEvent> =>
    ({
        correlationId: "corr-1",
        eventId: "evt-1",
        consumer: "decision-made",
        dedupeKey: "key-1",
        event: { eventId: "evt-1" },
        attempt: 2,
    }) as EventDelivery<DecisionMadeEvent>

describe("DecisionMadeConsumer", () => {
    it("listens to DecisionMadeEvent", () => {
        const subject = new DecisionMadeConsumer(mock<AutomationReactionsService>())

        expect(subject.event).toBe(DecisionMadeEvent)
    })

    it("hands the delivery itself to onDecisionMade and resolves with its result", async () => {
        const reactions = mock<AutomationReactionsService>()
        reactions.onDecisionMade.mockResolvedValue(undefined)
        const delivery = deliveryOf()

        await expect(new DecisionMadeConsumer(reactions).handle(delivery)).resolves.toBeUndefined()

        expect(reactions.onDecisionMade).toHaveBeenCalledTimes(1)
        expect(reactions.onDecisionMade).toHaveBeenCalledWith(delivery)
    })

    it("lets a failure of onDecisionMade reach the bus so the message reappears", async () => {
        const reactions = mock<AutomationReactionsService>()
        reactions.onDecisionMade.mockRejectedValue(new Error("boom"))

        await expect(new DecisionMadeConsumer(reactions).handle(deliveryOf())).rejects.toThrow("boom")
    })
})
