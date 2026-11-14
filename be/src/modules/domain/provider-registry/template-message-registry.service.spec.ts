import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TemplateMessageRegistryService } from "./template-message-registry.service"
import type { TemplateMessagePort } from "./template-message-ports.contracts"

describe("TemplateMessageRegistryService", () => {
    const build = async () => {
        const moduleRef = await Test.createTestingModule({ providers: [TemplateMessageRegistryService] }).compile()
        return moduleRef.get(TemplateMessageRegistryService)
    }

    it("starts with no provider and answers undefined for a key nobody registered", async () => {
        const registry = await build()

        expect(registry.all()).toEqual([])
        expect(registry.has("zalo")).toBe(false)
        expect(registry.of("zalo")).toBeUndefined()
    })

    it("finds a registered provider by its key, and a second registration under the key replaces the first", async () => {
        const registry = await build()
        const first = mock<TemplateMessagePort>({ provider: "zalo" })
        const second = mock<TemplateMessagePort>({ provider: "zalo" })

        registry.register(first)
        expect(registry.of("zalo")).toBe(first)
        registry.register(second)

        expect(registry.of("zalo")).toBe(second)
        expect(registry.all()).toHaveLength(1)
        expect(registry.all()[0]).toBe(second)
    })
})
