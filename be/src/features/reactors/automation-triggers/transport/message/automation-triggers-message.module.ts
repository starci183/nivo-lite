import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import {
    DEAL_WON_AUTOMATIONS_TOPIC_QUEUE,
    DECISION_MADE_AUTOMATIONS_TOPIC_QUEUE,
    LEAD_CAPTURED_AUTOMATIONS_TOPIC_QUEUE,
    ORDER_CONFIRMED_AUTOMATIONS_TOPIC_QUEUE,
    ORDER_SHIPPED_AUTOMATIONS_TOPIC_QUEUE,
    PAYMENT_RECONCILED_AUTOMATIONS_TOPIC_QUEUE,
    InjectEventConsumerRegistry,
} from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { AutomationTriggersModule } from "../../automation-triggers.module"
import { LeadCapturedConsumer } from "./lead_captured.consumer"
import { DealWonConsumer } from "./deal_won.consumer"
import { DecisionMadeConsumer } from "./decision_made.consumer"
import { PaymentReconciledConsumer } from "./payment_reconciled.consumer"
import { OrderConfirmedConsumer } from "./order_confirmed.consumer"
import { OrderShippedConsumer } from "./order_shipped.consumer"
import { ConfigurableModuleClass } from "./automation-triggers-message.module-definition"

@Module({
    imports: [AutomationTriggersModule.register({})],
    providers: [
        LeadCapturedConsumer,
        DealWonConsumer,
        DecisionMadeConsumer,
        PaymentReconciledConsumer,
        OrderConfirmedConsumer,
        OrderShippedConsumer,
    ],
})
/** The message transport of the automation-triggers reactor: subscribes its consumers to their queues; the api app composes it. */
export class AutomationTriggersMessageModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly leadCapturedConsumer: LeadCapturedConsumer,
        private readonly dealWonConsumer: DealWonConsumer,
        private readonly decisionMadeConsumer: DecisionMadeConsumer,
        private readonly paymentReconciledConsumer: PaymentReconciledConsumer,
        private readonly orderConfirmedConsumer: OrderConfirmedConsumer,
        private readonly orderShippedConsumer: OrderShippedConsumer,
    ) {
        super()
    }

    /** The subscriptions are static: one literal queue constant per consumer. */
    onModuleInit(): void {
        this.consumers.subscribe(LEAD_CAPTURED_AUTOMATIONS_TOPIC_QUEUE, this.leadCapturedConsumer)
        this.consumers.subscribe(DEAL_WON_AUTOMATIONS_TOPIC_QUEUE, this.dealWonConsumer)
        this.consumers.subscribe(DECISION_MADE_AUTOMATIONS_TOPIC_QUEUE, this.decisionMadeConsumer)
        this.consumers.subscribe(PAYMENT_RECONCILED_AUTOMATIONS_TOPIC_QUEUE, this.paymentReconciledConsumer)
        this.consumers.subscribe(ORDER_CONFIRMED_AUTOMATIONS_TOPIC_QUEUE, this.orderConfirmedConsumer)
        this.consumers.subscribe(ORDER_SHIPPED_AUTOMATIONS_TOPIC_QUEUE, this.orderShippedConsumer)
    }
}
