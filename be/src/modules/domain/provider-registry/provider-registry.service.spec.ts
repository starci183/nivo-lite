import {
    BankFeedPollerRegistry,
    BankTransactionsRegistry,
    PaymentInstructionRegistry,
} from "./provider-registries.service"

const port = (provider: string) => ({ provider, qrUrl: () => provider })

describe("ProviderRegistry", () => {
    it("finds a registered port by its provider key, lists them in order and knows who is missing", () => {
        const registry = new PaymentInstructionRegistry()
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
        const registry = new PaymentInstructionRegistry()
        const replacement = port("sepay")

        registry.register(port("sepay"))
        registry.register(replacement)

        expect(registry.all()).toEqual([replacement])
    })

    it("keeps the registries of the capabilities apart", () => {
        expect(new BankFeedPollerRegistry().all()).toEqual([])
        expect(new BankTransactionsRegistry().all()).toEqual([])
    })
})
