import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { BANK_CREDIT_BOOKED_ACCOUNTING_TOPIC_QUEUE, InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { BankCreditSettlementModule } from "../../bank-credit-settlement.module"
import { BankCreditBookedConsumer } from "./bank_credit_booked.consumer"
import { ConfigurableModuleClass } from "./bank-credit-settlement-message.module-definition"

@Module({ imports: [BankCreditSettlementModule.register({})], providers: [BankCreditBookedConsumer] })
/** The message transport of the bank-credit-settlement reactor: subscribes its consumers to their queues; the api app composes it. */
export class BankCreditSettlementMessageModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly bankCreditBookedConsumer: BankCreditBookedConsumer,
    ) {
        super()
    }

    /** The subscriptions are static: one literal queue constant per consumer. */
    onModuleInit(): void {
        this.consumers.subscribe(BANK_CREDIT_BOOKED_ACCOUNTING_TOPIC_QUEUE, this.bankCreditBookedConsumer)
    }
}
