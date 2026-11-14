import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import {
    BankFeedPollerRegistryService,
    BankTransactionsRegistryService,
    PaymentInstructionRegistryService,
} from "@modules/domain/provider-registry"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { SepayBankTransactionsService } from "./sepay-bank-transactions.service"
import { SepayFeedPollerService } from "./sepay-feed-poller.service"
import { SepayFeedWebhookService } from "./sepay-feed-webhook.service"
import { SepayPaymentInstructionService } from "./sepay-payment-instruction.service"
import { SEPAY_SANDBOX_CATALOGUE } from "./sepay-sandbox.catalogue"
import { SepaySandboxBankTransactionsService } from "./sepay-sandbox-bank-transactions.service"
import { SepaySandboxFeedPollerService } from "./sepay-sandbox-feed-poller.service"
import { SepaySandboxPaymentInstructionService } from "./sepay-sandbox-payment-instruction.service"
import { SepayProviderModule } from "./sepay-provider.module"
import { SepayProviderRegistrationService } from "./sepay-provider-registration.service"

const build = async () => {
    const pollers = mock<BankFeedPollerRegistryService>()
    const transactions = mock<BankTransactionsRegistryService>()
    const instructions = mock<PaymentInstructionRegistryService>()
    const poller = mock<SepayFeedPollerService>()
    const lister = mock<SepayBankTransactionsService>()
    const instruction = mock<SepayPaymentInstructionService>()
    const pollerSandbox = mock<SepaySandboxFeedPollerService>()
    const listerSandbox = mock<SepaySandboxBankTransactionsService>()
    const instructionSandbox = mock<SepaySandboxPaymentInstructionService>()
    const catalogues = mock<SandboxCatalogueRegistryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SepayProviderRegistrationService,
            { provide: BankFeedPollerRegistryService, useValue: pollers },
            { provide: BankTransactionsRegistryService, useValue: transactions },
            { provide: PaymentInstructionRegistryService, useValue: instructions },
            { provide: SepayFeedPollerService, useValue: poller },
            { provide: SepayBankTransactionsService, useValue: lister },
            { provide: SepayPaymentInstructionService, useValue: instruction },
            { provide: SepaySandboxFeedPollerService, useValue: pollerSandbox },
            { provide: SepaySandboxBankTransactionsService, useValue: listerSandbox },
            { provide: SepaySandboxPaymentInstructionService, useValue: instructionSandbox },
            { provide: SandboxCatalogueRegistryService, useValue: catalogues },
        ],
    }).compile()
    return {
        service: moduleRef.get(SepayProviderRegistrationService),
        pollers,
        transactions,
        instructions,
        poller,
        lister,
        instruction,
        pollerSandbox,
        listerSandbox,
        instructionSandbox,
        catalogues,
    }
}

describe("SepayProviderRegistrationService.onModuleInit", () => {
    it("registers what SePay can do, live and sandbox, in each capability registry, and its catalogue", async () => {
        const built = await build()

        built.service.onModuleInit()

        expect(built.pollers.register).toHaveBeenCalledWith({ live: built.poller, sandbox: built.pollerSandbox })
        expect(built.transactions.register).toHaveBeenCalledWith({ live: built.lister, sandbox: built.listerSandbox })
        expect(built.instructions.register).toHaveBeenCalledWith({ live: built.instruction, sandbox: built.instructionSandbox })
        expect(built.catalogues.register).toHaveBeenCalledWith(SEPAY_SANDBOX_CATALOGUE)
    })
})

describe("SepayProviderModule.register", () => {
    it("provides no webhook in an app that does not receive the feed webhook", () => {
        expect(SepayProviderModule.register({}).providers).not.toContain(SepayFeedWebhookService)
    })

    it("provides the four implementations and exports them in the app that receives the webhook", () => {
        const registered = SepayProviderModule.register({ feedWebhook: true })
        const implementations = [
            SepayFeedPollerService,
            SepayBankTransactionsService,
            SepayPaymentInstructionService,
            SepayFeedWebhookService,
            SepaySandboxFeedPollerService,
            SepaySandboxBankTransactionsService,
            SepaySandboxPaymentInstructionService,
        ]

        expect(registered.providers).toEqual(expect.arrayContaining(implementations))
        expect(registered.exports).toEqual(expect.arrayContaining(implementations.slice(0, 4)))
    })
})
