import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectWorkPerformerRegistry } from "@modules/domain/decisions"
import type { WorkPerformerRegistry } from "@modules/domain/decisions"
import { RECORD_RECEIVABLE_PAYMENT } from "./accounting-decisions.service"
import { ReceivablePaymentPerformerService } from "./receivable-payment-performer.service"

@Injectable()
/** Registers the accounting desk's performers with the work engine at boot; `review_einvoice` has none and only records its decision. */
export class AccountingPerformersRegistrarService implements OnModuleInit {
    constructor(
        @InjectWorkPerformerRegistry() private readonly registry: WorkPerformerRegistry,
        private readonly payment: ReceivablePaymentPerformerService,
    ) {}

    /** Adds the receivable payment performer to the registry. */
    onModuleInit(): void {
        this.registry.add(RECORD_RECEIVABLE_PAYMENT, this.payment)
    }
}
