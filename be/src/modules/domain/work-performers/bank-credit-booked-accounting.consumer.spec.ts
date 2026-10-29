import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { BankCreditBookedEvent } from "@modules/events/api"
import { BANK_CREDIT_BOOKED_ACCOUNTING_TOPIC_QUEUE, EVENT_CONSUMER_REGISTRY } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { BankCreditBookedAccountingConsumer } from "./bank-credit-booked-accounting.consumer"
import { BankCreditSettlementService } from "./bank-credit-settlement.service"

const build = async () => {
    const registry = mock<EventConsumerRegistry>()
    const settlement = mock<BankCreditSettlementService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            BankCreditBookedAccountingConsumer,
            { provide: EVENT_CONSUMER_REGISTRY, useValue: registry },
            { provide: BankCreditSettlementService, useValue: settlement },
        ],
    }).compile()
    return { consumer: moduleRef.get(BankCreditBookedAccountingConsumer), registry, settlement }
}

describe("BankCreditBookedAccountingConsumer", () => {
    it("subscribes itself to the accounting queue of bank_credit_booked", async () => {
        const { consumer, registry } = await build()

        consumer.onModuleInit()

        expect(registry.subscribe).toHaveBeenCalledWith(BANK_CREDIT_BOOKED_ACCOUNTING_TOPIC_QUEUE, consumer)
        expect(consumer.event).toBe(BankCreditBookedEvent)
    })

    it("hands the delivery key and the payload of a delivery to the settlement", async () => {
        const { consumer, settlement } = await build()
        const event = BankCreditBookedEvent.create({ workspaceId: "ws-1", inboundEventId: "ev-1", amountVnd: 450000 })

        await consumer.handle({
            correlationId: "c-1",
            eventId: event.eventId,
            consumer: BANK_CREDIT_BOOKED_ACCOUNTING_TOPIC_QUEUE,
            dedupeKey: "ev-1",
            event,
            attempt: 1,
        })

        expect(settlement.settle).toHaveBeenCalledWith(BANK_CREDIT_BOOKED_ACCOUNTING_TOPIC_QUEUE, "ev-1", event.payload)
    })
})
