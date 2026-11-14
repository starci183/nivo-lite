import { ProviderRegistryError, ProviderRegistryErrorCode } from "./errors/provider-registry.error"
import {
    BankFeedPollerRegistryService,
    BankTransactionsRegistryService,
    PaymentInstructionRegistryService,
} from "./provider-registries.service"

const port = (provider: string) => ({ provider, qrUrl: () => provider, transfer: () => Promise.reject(new ProviderRegistryError({ code: ProviderRegistryErrorCode.CallNotSent })) })

const live = (provider: string) => ({ provider, sandbox: false })
const sandboxed = (provider: string) => ({ provider, sandbox: true })

describe("ProviderRegistryService", () => {
    it("resolves a live account to its provider's live port, lists the providers in order and knows who is missing", () => {
        const registry = new PaymentInstructionRegistryService()
        const first = port("sepay")
        const second = port("casso")

        registry.register(first)
        registry.register(second)

        expect(registry.portFor(live("sepay"))).toBe(first)
        expect(registry.liveOf("casso")).toBe(second)
        expect(registry.has("casso")).toBe(true)
        expect(registry.has("payos")).toBe(false)
        expect(registry.portFor(live("payos"))).toBeUndefined()
        expect(registry.providers()).toEqual(["sepay", "casso"])
    })

    it("lets a second registration under a key replace the first", () => {
        const registry = new PaymentInstructionRegistryService()
        const replacement = port("sepay")

        registry.register({ live: port("sepay"), sandbox: port("sepay") })
        registry.register(replacement)

        expect(registry.portFor(live("sepay"))).toBe(replacement)
        expect(registry.providers()).toEqual(["sepay"])
        expect(() => registry.portFor(sandboxed("sepay"))).toThrow(expect.objectContaining({ code: ProviderRegistryErrorCode.SandboxMissing }))
    })

    it("resolves a SANDBOX account to the sandbox port only, and a LIVE account never to it", () => {
        const registry = new PaymentInstructionRegistryService()
        const real = port("sepay")
        const twin = port("sepay")

        registry.register({ live: real, sandbox: twin })

        expect(registry.portFor(sandboxed("sepay"))).toBe(twin)
        expect(registry.portFor(live("sepay"))).toBe(real)
        expect(registry.liveOf("sepay")).toBe(real)
    })

    it("refuses a sandbox account whose provider registered no sandbox implementation, never falling back to live", () => {
        const registry = new PaymentInstructionRegistryService()
        registry.register(port("sepay"))

        const refusal = (): unknown => registry.portFor(sandboxed("sepay"))

        expect(refusal).toThrow(ProviderRegistryError)
        expect(refusal).toThrow(expect.objectContaining({ code: ProviderRegistryErrorCode.SandboxMissing, params: { provider: "sepay" } }))
        expect(() => registry.portFor(sandboxed("payos"))).toThrow(expect.objectContaining({ code: ProviderRegistryErrorCode.SandboxMissing }))
    })

    it("refuses a pair whose sandbox names another provider", () => {
        const registry = new PaymentInstructionRegistryService()
        expect(() => registry.register({ live: port("sepay"), sandbox: port("casso") })).toThrow(
            expect.objectContaining({ code: ProviderRegistryErrorCode.SandboxMismatch }),
        )
        expect(registry.providers()).toEqual([])
    })

    it("keeps the registries of the capabilities apart", () => {
        expect(new BankFeedPollerRegistryService().providers()).toEqual([])
        expect(new BankTransactionsRegistryService().providers()).toEqual([])
    })
})
