import { mock } from "@starci/jest-preset"
import {
    BankFeedPollerRegistry,
    BankTransactionsRegistry,
    PaymentInstructionRegistry,
} from "@modules/domain/provider-registry"
import { SepayBankTransactionsService } from "./sepay-bank-transactions.service"
import { SepayFeedPoller } from "./sepay-feed-poller.service"
import { SepayPaymentInstructionService } from "./sepay-payment-instruction.service"
import { SepayProviderModule } from "./sepay-provider.module"

describe("SepayProviderModule", () => {
    it("registers what SePay can do under its provider key in each capability registry", () => {
        const pollers = new BankFeedPollerRegistry()
        const transactions = new BankTransactionsRegistry()
        const instructions = new PaymentInstructionRegistry()
        const poller = mock<SepayFeedPoller>()
        const lister = mock<SepayBankTransactionsService>()
        const instruction = mock<SepayPaymentInstructionService>()

        new SepayProviderModule(pollers, transactions, instructions, poller, lister, instruction).onModuleInit()

        expect(pollers.all()).toEqual([poller])
        expect(transactions.all()).toEqual([lister])
        expect(instructions.all()).toEqual([instruction])
    })

    it("provides and exports the three implementations", () => {
        const registered = SepayProviderModule.register({})

        expect(registered.providers).toEqual(
            expect.arrayContaining([SepayFeedPoller, SepayBankTransactionsService, SepayPaymentInstructionService]),
        )
        expect(registered.exports).toEqual(
            expect.arrayContaining([SepayFeedPoller, SepayBankTransactionsService, SepayPaymentInstructionService]),
        )
    })
})
