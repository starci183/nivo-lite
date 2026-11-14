import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { PaymentLinkRegistryService } from "./payment-link-registry.service"
import type { PaymentLinkPort } from "./payment-link-ports.contracts"

describe("PaymentLinkRegistryService", () => {
    const build = async () => {
        const moduleRef = await Test.createTestingModule({ providers: [PaymentLinkRegistryService] }).compile()
        return moduleRef.get(PaymentLinkRegistryService)
    }

    it("starts with no provider and answers undefined for a key nobody registered", async () => {
        const registry = await build()

        expect(registry.all()).toEqual([])
        expect(registry.has("payos")).toBe(false)
        expect(registry.of("payos")).toBeUndefined()
    })

    it("finds a registered provider by its key, and a second registration under the key replaces the first", async () => {
        const registry = await build()
        const first = mock<PaymentLinkPort>({ provider: "payos" })
        const second = mock<PaymentLinkPort>({ provider: "payos" })

        registry.register(first)
        expect(registry.of("payos")).toBe(first)
        registry.register(second)

        expect(registry.of("payos")).toBe(second)
        expect(registry.all()).toHaveLength(1)
        expect(registry.all()[0]).toBe(second)
    })
})
