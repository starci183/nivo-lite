import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import {
    BANK_CREDIT_BOOKED_AGENT_WAKES_TOPIC_QUEUE,
    INSTALLATION_CHANGED_AGENT_WAKES_TOPIC_QUEUE,
    InjectEventConsumerRegistry,
    KNOWLEDGE_SOURCE_INDEXED_AGENT_WAKES_TOPIC_QUEUE,
    PAYMENT_RECONCILED_AGENT_WAKES_TOPIC_QUEUE,
} from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { AgentWakesModule } from "../../agent-wakes.module"
import { BankCreditBookedConsumer } from "./bank-credit-booked.consumer"
import { InstallationChangedConsumer } from "./installation-changed.consumer"
import { KnowledgeSourceIndexedConsumer } from "./knowledge-source-indexed.consumer"
import { PaymentReconciledConsumer } from "./payment-reconciled.consumer"
import { ConfigurableModuleClass } from "./agent-wakes-message.module-definition"

@Module({
    imports: [AgentWakesModule.register({})],
    providers: [
        BankCreditBookedConsumer,
        PaymentReconciledConsumer,
        KnowledgeSourceIndexedConsumer,
        InstallationChangedConsumer,
    ],
})
/** The message transport of the agent-wakes reactor: subscribes its consumers to their queues; the api app composes it. */
export class AgentWakesMessageModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly bankCreditBookedConsumer: BankCreditBookedConsumer,
        private readonly paymentReconciledConsumer: PaymentReconciledConsumer,
        private readonly knowledgeSourceIndexedConsumer: KnowledgeSourceIndexedConsumer,
        private readonly installationChangedConsumer: InstallationChangedConsumer,
    ) {
        super()
    }

    /** The subscriptions are static: one literal queue constant per consumer. */
    onModuleInit(): void {
        this.consumers.subscribe(BANK_CREDIT_BOOKED_AGENT_WAKES_TOPIC_QUEUE, this.bankCreditBookedConsumer)
        this.consumers.subscribe(PAYMENT_RECONCILED_AGENT_WAKES_TOPIC_QUEUE, this.paymentReconciledConsumer)
        this.consumers.subscribe(KNOWLEDGE_SOURCE_INDEXED_AGENT_WAKES_TOPIC_QUEUE, this.knowledgeSourceIndexedConsumer)
        this.consumers.subscribe(INSTALLATION_CHANGED_AGENT_WAKES_TOPIC_QUEUE, this.installationChangedConsumer)
    }
}
