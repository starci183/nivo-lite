import { mock } from "@starci/jest-preset"
import { PaymentReconciledEvent } from "@modules/events/api"
import type { EventDelivery } from "@modules/platform/event-bus"
import type { AutomationReactionsService } from "../automation-reactions.service"
import { PaymentReceiptConsumer } from "./payment-receipt.consumer"

const deliveryOf = (): EventDelivery<PaymentReconciledEvent> =>
    ({
        correlationId: "corr-1",
        eventId: "evt-1",
        consumer: "payment-receipt",
        dedupeKey: "key-1",
        event: { eventId: "evt-1" },
        attempt: 2,
    }) as EventDelivery<PaymentReconciledEvent>

describe("PaymentReceiptConsumer", () => {
    it("listens to PaymentReconciledEvent", () => {
        const subject = new PaymentReceiptConsumer(mock<AutomationReactionsService>())

        expect(subject.event).toBe(PaymentReconciledEvent)
    })

    it("hands the delivery itself to onPaymentReceipt and resolves with its result", async () => {
        const reactions = mock<AutomationReactionsService>()
        reactions.onPaymentReceipt.mockResolvedValue(undefined)
        const delivery = deliveryOf()

        await expect(new PaymentReceiptConsumer(reactions).handle(delivery)).resolves.toBeUndefined()

        expect(reactions.onPaymentReceipt).toHaveBeenCalledTimes(1)
        expect(reactions.onPaymentReceipt).toHaveBeenCalledWith(delivery)
    })

    it("lets a failure of onPaymentReceipt reach the bus so the message reappears", async () => {
        const reactions = mock<AutomationReactionsService>()
        reactions.onPaymentReceipt.mockRejectedValue(new Error("boom"))

        await expect(new PaymentReceiptConsumer(reactions).handle(deliveryOf())).rejects.toThrow("boom")
    })
})
