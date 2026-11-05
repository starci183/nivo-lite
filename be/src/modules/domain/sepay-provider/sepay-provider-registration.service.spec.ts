import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import {
    BankFeedPollerRegistryService,
    BankTransactionsRegistryService,
    PaymentInstructionRegistryService,
} from "@modules/domain/provider-registry"
import { SepayBankTransactionsService } from "./sepay-bank-transactions.service"
import { SepayFeedPollerService } from "./sepay-feed-poller.service"
import { SepayFeedWebhookService } from "./sepay-feed-webhook.service"
import { SepayPaymentInstructionService } from "./sepay-payment-instruction.service"
import { SepayProviderModule } from "./sepay-provider.module"
import { SepayProviderRegistrationService } from "./sepay-provider-registration.service"

const build = async () => {
    const pollers = mock<BankFeedPollerRegistryService>()
    const transactions = mock<BankTransactionsRegistryService>()
    const instructions = mock<PaymentInstructionRegistryService>()
    const poller = mock<SepayFeedPollerService>()
    const lister = mock<SepayBankTransactionsService>()
    const instruction = mock<SepayPaymentInstructionService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SepayProviderRegistrationService,
            { provide: BankFeedPollerRegistryService, useValue: pollers },
            { provide: BankTransactionsRegistryService, useValue: transactions },
            { provide: PaymentInstructionRegistryService, useValue: instructions },
            { provide: SepayFeedPollerService, useValue: poller },
            { provide: SepayBankTransactionsService, useValue: lister },
            { provide: SepayPaymentInstructionService, useValue: instruction },
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
    }
}

describe("SepayProviderRegistrationService.onModuleInit", () => {
    it("registers what SePay can do under its provider key in each capability registry", async () => {
        const { service, pollers, transactions, instructions, poller, lister, instruction } = await build()

        service.onModuleInit()

        expect(pollers.register).toHaveBeenCalledWith(poller)
        expect(transactions.register).toHaveBeenCalledWith(lister)
        expect(instructions.register).toHaveBeenCalledWith(instruction)
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
        ]

        expect(registered.providers).toEqual(expect.arrayContaining(implementations))
        expect(registered.exports).toEqual(expect.arrayContaining(implementations))
    })
})
