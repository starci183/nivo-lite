import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import {
    DEAL_WON_AUTOMATIONS_TOPIC_QUEUE,
    DECISION_MADE_AUTOMATIONS_TOPIC_QUEUE,
    InjectEventConsumerRegistry,
    LEAD_CAPTURED_AUTOMATIONS_TOPIC_QUEUE,
    ORDER_CONFIRMED_AUTOMATIONS_TOPIC_QUEUE,
    ORDER_SHIPPED_AUTOMATIONS_TOPIC_QUEUE,
    PAYMENT_RECONCILED_AUTOMATIONS_TOPIC_QUEUE,
    PAYMENT_RECONCILED_PAYMENT_RECEIPTS_TOPIC_QUEUE,
} from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { DealWonConsumer } from "./reactors/deal-won.consumer"
import { DecisionMadeConsumer } from "./reactors/decision-made.consumer"
import { LeadCapturedConsumer } from "./reactors/lead-captured.consumer"
import { OrderConfirmedConsumer } from "./reactors/order-confirmed.consumer"
import { OrderShippedConsumer } from "./reactors/order-shipped.consumer"
import { PaymentReceiptConsumer } from "./reactors/payment-receipt.consumer"
import { PaymentReconciledConsumer } from "./reactors/payment-reconciled.consumer"

@Injectable()
/** Subscribes the automations reactors, and the payment receipt reactor, to their queues on the event bus. */
export class AutomationReactorsService implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly leadCaptured: LeadCapturedConsumer,
        private readonly dealWon: DealWonConsumer,
        private readonly decisionMade: DecisionMadeConsumer,
        private readonly paymentReconciled: PaymentReconciledConsumer,
        private readonly paymentReceipt: PaymentReceiptConsumer,
        private readonly orderConfirmed: OrderConfirmedConsumer,
        private readonly orderShipped: OrderShippedConsumer,
    ) {}

    /** The subscriptions are static: one literal queue constant per reactor. */
    onModuleInit(): void {
        this.consumers.subscribe(LEAD_CAPTURED_AUTOMATIONS_TOPIC_QUEUE, this.leadCaptured)
        this.consumers.subscribe(DEAL_WON_AUTOMATIONS_TOPIC_QUEUE, this.dealWon)
        this.consumers.subscribe(DECISION_MADE_AUTOMATIONS_TOPIC_QUEUE, this.decisionMade)
        this.consumers.subscribe(PAYMENT_RECONCILED_AUTOMATIONS_TOPIC_QUEUE, this.paymentReconciled)
        this.consumers.subscribe(PAYMENT_RECONCILED_PAYMENT_RECEIPTS_TOPIC_QUEUE, this.paymentReceipt)
        this.consumers.subscribe(ORDER_CONFIRMED_AUTOMATIONS_TOPIC_QUEUE, this.orderConfirmed)
        this.consumers.subscribe(ORDER_SHIPPED_AUTOMATIONS_TOPIC_QUEUE, this.orderShipped)
    }
}
