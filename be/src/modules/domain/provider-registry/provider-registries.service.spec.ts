import { Test } from "@nestjs/testing"
import { ProviderRegistryError, ProviderRegistryErrorCode } from "./errors/provider-registry.error"
import {
    BankFeedPollerRegistryService,
    BankTransactionsRegistryService,
    FeedWebhookRegistryService,
    LedgerRegistryService,
    MessageInboxPollerRegistryService,
    PaymentInstructionRegistryService,
} from "./provider-registries.service"

/** Every registry, each built alone in its own test module. */
const build = async () => {
    const feedPollers = await Test.createTestingModule({ providers: [BankFeedPollerRegistryService] }).compile()
    const instructions = await Test.createTestingModule({ providers: [PaymentInstructionRegistryService] }).compile()
    const transactions = await Test.createTestingModule({ providers: [BankTransactionsRegistryService] }).compile()
    const webhooks = await Test.createTestingModule({ providers: [FeedWebhookRegistryService] }).compile()
    const inboxes = await Test.createTestingModule({ providers: [MessageInboxPollerRegistryService] }).compile()
    const ledgers = await Test.createTestingModule({ providers: [LedgerRegistryService] }).compile()
    return {
        feedPollers: feedPollers.get(BankFeedPollerRegistryService),
        instructions: instructions.get(PaymentInstructionRegistryService),
        transactions: transactions.get(BankTransactionsRegistryService),
        webhooks: webhooks.get(FeedWebhookRegistryService),
        inboxes: inboxes.get(MessageInboxPollerRegistryService),
        ledgers: ledgers.get(LedgerRegistryService),
    }
}

describe("the registries of the provider capabilities", () => {
    it("start empty, each on its own", async () => {
        const registries = await build()

        for (const registry of Object.values(registries)) expect(registry.all()).toEqual([])
    })

    it("keep the registrations of one capability apart from the others", async () => {
        const { instructions, transactions } = await build()
        const port = { provider: "sepay", qrUrl: () => "qr", transfer: () => Promise.reject(new ProviderRegistryError({ code: ProviderRegistryErrorCode.CallNotSent })) }

        instructions.register(port)

        expect(instructions.of("sepay")).toBe(port)
        expect(transactions.has("sepay")).toBe(false)
    })
})
