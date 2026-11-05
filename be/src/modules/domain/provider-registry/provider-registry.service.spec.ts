import {
    BankFeedPollerRegistryService,
    BankTransactionsRegistryService,
    PaymentInstructionRegistryService,
} from "./provider-registries.service"

const port = (provider: string) => ({ provider, qrUrl: () => provider })

describe("ProviderRegistryService", () => {
    it("finds a registered port by its provider key, lists them in order and knows who is missing", () => {
        const registry = new PaymentInstructionRegistryService()
        const first = port("sepay")
        const second = port("casso")

        registry.register(first)
        registry.register(second)

        expect(registry.of("sepay")).toBe(first)
        expect(registry.has("casso")).toBe(true)
        expect(registry.has("payos")).toBe(false)
        expect(registry.of("payos")).toBeUndefined()
        expect(registry.all()).toEqual([first, second])
    })

    it("lets a second registration under a key replace the first", () => {
        const registry = new PaymentInstructionRegistryService()
        const replacement = port("sepay")

        registry.register(port("sepay"))
        registry.register(replacement)

        expect(registry.all()).toEqual([replacement])
    })

    it("keeps the registries of the capabilities apart", () => {
        expect(new BankFeedPollerRegistryService().all()).toEqual([])
        expect(new BankTransactionsRegistryService().all()).toEqual([])
    })
})
