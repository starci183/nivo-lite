import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import {
    DEAL_WON_AUTOMATIONS_TOPIC_QUEUE,
    DECISION_MADE_AUTOMATIONS_TOPIC_QUEUE,
    EVENT_CONSUMER_REGISTRY,
    LEAD_CAPTURED_AUTOMATIONS_TOPIC_QUEUE,
    ORDER_CONFIRMED_AUTOMATIONS_TOPIC_QUEUE,
    ORDER_SHIPPED_AUTOMATIONS_TOPIC_QUEUE,
    PAYMENT_RECONCILED_AUTOMATIONS_TOPIC_QUEUE,
    PAYMENT_RECONCILED_PAYMENT_RECEIPTS_TOPIC_QUEUE,
} from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { AutomationReactorsService } from "./automation-reactors.service"
import { DealWonConsumer } from "./reactors/deal-won.consumer"
import { DecisionMadeConsumer } from "./reactors/decision-made.consumer"
import { LeadCapturedConsumer } from "./reactors/lead-captured.consumer"
import { OrderConfirmedConsumer } from "./reactors/order-confirmed.consumer"
import { OrderShippedConsumer } from "./reactors/order-shipped.consumer"
import { PaymentReceiptConsumer } from "./reactors/payment-receipt.consumer"
import { PaymentReconciledConsumer } from "./reactors/payment-reconciled.consumer"

const build = async () => {
    const registry = mock<EventConsumerRegistry>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AutomationReactorsService,
            { provide: EVENT_CONSUMER_REGISTRY, useValue: registry },
            { provide: LeadCapturedConsumer, useValue: mock<LeadCapturedConsumer>() },
            { provide: DealWonConsumer, useValue: mock<DealWonConsumer>() },
            { provide: DecisionMadeConsumer, useValue: mock<DecisionMadeConsumer>() },
            { provide: PaymentReconciledConsumer, useValue: mock<PaymentReconciledConsumer>() },
            { provide: PaymentReceiptConsumer, useValue: mock<PaymentReceiptConsumer>() },
            { provide: OrderConfirmedConsumer, useValue: mock<OrderConfirmedConsumer>() },
            { provide: OrderShippedConsumer, useValue: mock<OrderShippedConsumer>() },
        ],
    }).compile()
    return { registry, moduleRef, service: moduleRef.get(AutomationReactorsService) }
}

describe("AutomationReactorsService", () => {
    it("subscribes each reactor to its own queue, in order, and nothing else", async () => {
        const { registry, moduleRef, service } = await build()

        service.onModuleInit()

        expect(registry.subscribe.mock.calls).toEqual([
            [LEAD_CAPTURED_AUTOMATIONS_TOPIC_QUEUE, moduleRef.get(LeadCapturedConsumer)],
            [DEAL_WON_AUTOMATIONS_TOPIC_QUEUE, moduleRef.get(DealWonConsumer)],
            [DECISION_MADE_AUTOMATIONS_TOPIC_QUEUE, moduleRef.get(DecisionMadeConsumer)],
            [PAYMENT_RECONCILED_AUTOMATIONS_TOPIC_QUEUE, moduleRef.get(PaymentReconciledConsumer)],
            [PAYMENT_RECONCILED_PAYMENT_RECEIPTS_TOPIC_QUEUE, moduleRef.get(PaymentReceiptConsumer)],
            [ORDER_CONFIRMED_AUTOMATIONS_TOPIC_QUEUE, moduleRef.get(OrderConfirmedConsumer)],
            [ORDER_SHIPPED_AUTOMATIONS_TOPIC_QUEUE, moduleRef.get(OrderShippedConsumer)],
        ])
    })
})
