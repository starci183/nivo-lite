import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import {
    BankFeedPollerRegistryService,
    BankTransactionsRegistryService,
    PaymentInstructionRegistryService,
} from "@modules/domain/provider-registry"
import { SepayBankTransactionsService } from "./sepay-bank-transactions.service"
import { SepayFeedPollerService } from "./sepay-feed-poller.service"
import { SepayPaymentInstructionService } from "./sepay-payment-instruction.service"

@Injectable()
/**
 * Hands each thing SePay can do for core to the registry that asks for it, once, when the app starts: the poller that reads its
 * transactions back, the transaction list and the payment instruction its MCP tools answer with. The webhook registers itself, because
 * only the app that receives it provides it.
 */
export class SepayProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly pollers: BankFeedPollerRegistryService,
        private readonly transactions: BankTransactionsRegistryService,
        private readonly instructions: PaymentInstructionRegistryService,
        private readonly poller: SepayFeedPollerService,
        private readonly lister: SepayBankTransactionsService,
        private readonly instruction: SepayPaymentInstructionService,
    ) {}

    /** Hands each capability to its registry. */
    onModuleInit(): void {
        this.pollers.register(this.poller)
        this.transactions.register(this.lister)
        this.instructions.register(this.instruction)
    }
}
