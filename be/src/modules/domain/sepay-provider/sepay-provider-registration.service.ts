import { Injectable, type OnModuleInit } from "@nestjs/common"
import {
    BankFeedPollerRegistryService,
    BankTransactionsRegistryService,
    PaymentInstructionRegistryService,
} from "@modules/domain/provider-registry"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { SepayBankTransactionsService } from "./sepay-bank-transactions.service"
import { SepayFeedPollerService } from "./sepay-feed-poller.service"
import { SepayPaymentInstructionService } from "./sepay-payment-instruction.service"
import { SEPAY_SANDBOX_CATALOGUE } from "./sepay-sandbox.catalogue"
import { SepaySandboxBankTransactionsService } from "./sepay-sandbox-bank-transactions.service"
import { SepaySandboxFeedPollerService } from "./sepay-sandbox-feed-poller.service"
import { SepaySandboxPaymentInstructionService } from "./sepay-sandbox-payment-instruction.service"

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
        private readonly pollerSandbox: SepaySandboxFeedPollerService,
        private readonly listerSandbox: SepaySandboxBankTransactionsService,
        private readonly instructionSandbox: SepaySandboxPaymentInstructionService,
        private readonly catalogues: SandboxCatalogueRegistryService,
    ) {}

    /** Hands each capability to its registry with its sandbox twin, and the sandbox catalogue to the catalogue registry. */
    onModuleInit(): void {
        this.pollers.register({ live: this.poller, sandbox: this.pollerSandbox })
        this.transactions.register({ live: this.lister, sandbox: this.listerSandbox })
        this.instructions.register({ live: this.instruction, sandbox: this.instructionSandbox })
        this.catalogues.register(SEPAY_SANDBOX_CATALOGUE)
    }
}
