import {
    BankFeedPollerRegistry,
    BankTransactionsRegistry,
    PaymentInstructionRegistry,
} from "./provider-registries.service"
import { ProviderRegistryModule } from "./provider-registry.module"

describe("ProviderRegistryModule", () => {
    it("provides and exports one registry per capability", () => {
        const registered = ProviderRegistryModule.register({})
        const registries = [BankFeedPollerRegistry, PaymentInstructionRegistry, BankTransactionsRegistry]

        expect(registered.providers).toEqual(expect.arrayContaining(registries))
        expect(registered.exports).toEqual(registries)
    })
})
