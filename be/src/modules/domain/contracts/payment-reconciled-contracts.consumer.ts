import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { PaymentReconciledEvent } from "@modules/events/api"
import { InjectEventConsumerRegistry, PAYMENT_RECONCILED_CONTRACTS_TOPIC_QUEUE } from "@modules/platform/event-bus"
import type { EventConsumer, EventConsumerRegistry, EventDelivery } from "@modules/platform/event-bus"
import { ContractRenewalService } from "./contract-renewal.service"

@Injectable()
/** The `contracts` reactor of `payment_reconciled`: a thin door that hands a settled invoice to the renewal command. */
export class PaymentReconciledContractsConsumer implements EventConsumer<PaymentReconciledEvent>, OnModuleInit {
    readonly event = PaymentReconciledEvent

    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly renewal: ContractRenewalService,
    ) {}

    /** Subscribes this door to its queue; reading starts when the app has bootstrapped. */
    onModuleInit(): void {
        this.consumers.subscribe(PAYMENT_RECONCILED_CONTRACTS_TOPIC_QUEUE, this)
    }

    /** Applies one delivery. */
    handle(delivery: EventDelivery<PaymentReconciledEvent>): Promise<void> {
        return this.renewal.renewForPaidInvoice(delivery.consumer, delivery.dedupeKey, delivery.event.payload)
    }
}
