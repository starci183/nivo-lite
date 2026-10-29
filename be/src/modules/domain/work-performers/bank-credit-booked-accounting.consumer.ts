import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { BankCreditBookedEvent } from "@modules/events/api"
import { BANK_CREDIT_BOOKED_ACCOUNTING_TOPIC_QUEUE, InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumer, EventConsumerRegistry, EventDelivery } from "@modules/platform/event-bus"
import { BankCreditSettlementService } from "./bank-credit-settlement.service"

@Injectable()
/** The `accounting` reactor of `bank_credit_booked`: a thin door that hands a booked credit to its settlement. */
export class BankCreditBookedAccountingConsumer implements EventConsumer<BankCreditBookedEvent>, OnModuleInit {
    readonly event = BankCreditBookedEvent

    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly settlement: BankCreditSettlementService,
    ) {}

    /** Subscribes this door to its queue; reading starts when the app has bootstrapped. */
    onModuleInit(): void {
        this.consumers.subscribe(BANK_CREDIT_BOOKED_ACCOUNTING_TOPIC_QUEUE, this)
    }

    /** Applies one delivery. */
    handle(delivery: EventDelivery<BankCreditBookedEvent>): Promise<void> {
        return this.settlement.settle(delivery.consumer, delivery.dedupeKey, delivery.event.payload)
    }
}
