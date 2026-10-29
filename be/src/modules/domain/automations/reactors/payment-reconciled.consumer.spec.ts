import { mock } from "@starci/jest-preset"
import { PaymentReconciledEvent } from "@modules/events/api"
import type { EventDelivery } from "@modules/platform/event-bus"
import type { AutomationReactionsService } from "../automation-reactions.service"
import { PaymentReconciledConsumer } from "./payment-reconciled.consumer"

const deliveryOf = (): EventDelivery<PaymentReconciledEvent> =>
    ({
        correlationId: "corr-1",
        eventId: "evt-1",
        consumer: "payment-reconciled",
        dedupeKey: "key-1",
        event: { eventId: "evt-1" },
        attempt: 2,
    }) as EventDelivery<PaymentReconciledEvent>

describe("PaymentReconciledConsumer", () => {
    it("listens to PaymentReconciledEvent", () => {
        const subject = new PaymentReconciledConsumer(mock<AutomationReactionsService>())

        expect(subject.event).toBe(PaymentReconciledEvent)
    })

    it("hands the delivery itself to onPaymentReconciled and resolves with its result", async () => {
        const reactions = mock<AutomationReactionsService>()
        reactions.onPaymentReconciled.mockResolvedValue(undefined)
        const delivery = deliveryOf()

        await expect(new PaymentReconciledConsumer(reactions).handle(delivery)).resolves.toBeUndefined()

        expect(reactions.onPaymentReconciled).toHaveBeenCalledTimes(1)
        expect(reactions.onPaymentReconciled).toHaveBeenCalledWith(delivery)
    })

    it("lets a failure of onPaymentReconciled reach the bus so the message reappears", async () => {
        const reactions = mock<AutomationReactionsService>()
        reactions.onPaymentReconciled.mockRejectedValue(new Error("boom"))

        await expect(new PaymentReconciledConsumer(reactions).handle(deliveryOf())).rejects.toThrow("boom")
    })
})
