import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { PAYMENT_RECONCILED_CONTRACTS_TOPIC_QUEUE, InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { ContractRenewalModule } from "../../contract-renewal.module"
import { PaymentReconciledConsumer } from "./payment-reconciled.consumer"
import { ConfigurableModuleClass } from "./contract-renewal-message.module-definition"

@Module({ imports: [ContractRenewalModule.register({})], providers: [PaymentReconciledConsumer] })
/** The message transport of the contract-renewal reactor: subscribes its consumers to their queues; the api app composes it. */
export class ContractRenewalMessageModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly paymentReconciledConsumer: PaymentReconciledConsumer,
    ) {
        super()
    }

    /** The subscriptions are static: one literal queue constant per consumer. */
    onModuleInit(): void {
        this.consumers.subscribe(PAYMENT_RECONCILED_CONTRACTS_TOPIC_QUEUE, this.paymentReconciledConsumer)
    }
}
