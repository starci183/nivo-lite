import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { PaymentReconciledEvent } from "@modules/events/api"
import { EVENT_CONSUMER_REGISTRY, PAYMENT_RECONCILED_CONTRACTS_TOPIC_QUEUE } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { ContractRenewalService } from "./contract-renewal.service"
import { PaymentReconciledContractsConsumer } from "./payment-reconciled-contracts.consumer"

const build = async () => {
    const registry = mock<EventConsumerRegistry>()
    const renewal = mock<ContractRenewalService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentReconciledContractsConsumer,
            { provide: EVENT_CONSUMER_REGISTRY, useValue: registry },
            { provide: ContractRenewalService, useValue: renewal },
        ],
    }).compile()
    return { consumer: moduleRef.get(PaymentReconciledContractsConsumer), registry, renewal }
}

describe("PaymentReconciledContractsConsumer", () => {
    it("subscribes itself to the contracts queue of payment_reconciled", async () => {
        const { consumer, registry } = await build()

        consumer.onModuleInit()

        expect(registry.subscribe).toHaveBeenCalledWith(PAYMENT_RECONCILED_CONTRACTS_TOPIC_QUEUE, consumer)
        expect(consumer.event).toBe(PaymentReconciledEvent)
    })

    it("hands the delivery key and the payload of a delivery to the renewal command", async () => {
        const { consumer, renewal } = await build()
        const event = PaymentReconciledEvent.create({
            workspaceId: "ws-1",
            invoiceId: "inv-1",
            invoiceNo: "INV-1",
            amountVnd: 1,
            paidAt: null,
            transactionId: null,
            workItemId: "item-1",
            subjectType: null,
            subjectId: null,
            orderId: null,
            orderNo: null,
            leadId: null,
            customer: "Lan",
            channel: null,
            contractId: "contract-1",
            periodEndsOn: "2027-01-01",
        })

        await consumer.handle({
            correlationId: "c-1",
            eventId: event.eventId,
            consumer: PAYMENT_RECONCILED_CONTRACTS_TOPIC_QUEUE,
            dedupeKey: "inv-1",
            event,
            attempt: 1,
        })

        expect(renewal.renewForPaidInvoice).toHaveBeenCalledWith(
            PAYMENT_RECONCILED_CONTRACTS_TOPIC_QUEUE,
            "inv-1",
            event.payload,
        )
    })
})
