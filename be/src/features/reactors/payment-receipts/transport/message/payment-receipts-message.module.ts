import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import {
    PAYMENT_RECONCILED_PAYMENT_RECEIPTS_TOPIC_QUEUE,
    InjectEventConsumerRegistry,
} from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { PaymentReceiptsModule } from "../../payment-receipts.module"
import { PaymentReconciledConsumer } from "./payment_reconciled.consumer"
import { ConfigurableModuleClass } from "./payment-receipts-message.module-definition"

@Module({ imports: [PaymentReceiptsModule.register({})], providers: [PaymentReconciledConsumer] })
/** The message transport of the payment-receipts reactor: subscribes its consumers to their queues; the api app composes it. */
export class PaymentReceiptsMessageModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly paymentReconciledConsumer: PaymentReconciledConsumer,
    ) {
        super()
    }

    /** The subscriptions are static: one literal queue constant per consumer. */
    onModuleInit(): void {
        this.consumers.subscribe(PAYMENT_RECONCILED_PAYMENT_RECEIPTS_TOPIC_QUEUE, this.paymentReconciledConsumer)
    }
}
