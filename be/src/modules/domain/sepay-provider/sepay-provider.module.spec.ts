import { mock } from "@starci/jest-preset"
import {
    BankFeedPollerRegistry,
    BankTransactionsRegistry,
    FeedWebhookRegistry,
    PaymentInstructionRegistry,
} from "@modules/domain/provider-registry"
import { SepayBankTransactionsService } from "./sepay-bank-transactions.service"
import { SepayFeedWebhookService } from "./sepay-feed-webhook.service"
import { SepayFeedPoller } from "./sepay-feed-poller.service"
import { SepayPaymentInstructionService } from "./sepay-payment-instruction.service"
import { SepayProviderModule } from "./sepay-provider.module"

describe("SepayProviderModule", () => {
    it("registers what SePay can do under its provider key in each capability registry", () => {
        const pollers = new BankFeedPollerRegistry()
        const transactions = new BankTransactionsRegistry()
        const instructions = new PaymentInstructionRegistry()
        const webhooks = new FeedWebhookRegistry()
        const poller = mock<SepayFeedPoller>()
        const lister = mock<SepayBankTransactionsService>()
        const instruction = mock<SepayPaymentInstructionService>()
        const webhook = mock<SepayFeedWebhookService>()

        new SepayProviderModule(
            pollers,
            transactions,
            instructions,
            webhooks,
            poller,
            lister,
            instruction,
            webhook,
        ).onModuleInit()

        expect(pollers.all()).toEqual([poller])
        expect(transactions.all()).toEqual([lister])
        expect(instructions.all()).toEqual([instruction])
        expect(webhooks.all()).toEqual([webhook])
    })

    it("registers no webhook in an app that does not receive the feed's webhook", () => {
        const webhooks = new FeedWebhookRegistry()
        new SepayProviderModule(
            new BankFeedPollerRegistry(),
            new BankTransactionsRegistry(),
            new PaymentInstructionRegistry(),
            webhooks,
            mock<SepayFeedPoller>(),
            mock<SepayBankTransactionsService>(),
            mock<SepayPaymentInstructionService>(),
        ).onModuleInit()

        expect(webhooks.all()).toEqual([])
        expect(SepayProviderModule.register({}).providers).not.toContain(SepayFeedWebhookService)
    })

    it("provides and exports the four implementations in the app that receives the webhook", () => {
        const registered = SepayProviderModule.register({ feedWebhook: true })

        expect(registered.providers).toEqual(
            expect.arrayContaining([
                SepayFeedPoller,
                SepayBankTransactionsService,
                SepayPaymentInstructionService,
                SepayFeedWebhookService,
            ]),
        )
        expect(registered.exports).toEqual(
            expect.arrayContaining([
                SepayFeedPoller,
                SepayBankTransactionsService,
                SepayPaymentInstructionService,
                SepayFeedWebhookService,
            ]),
        )
    })
})
