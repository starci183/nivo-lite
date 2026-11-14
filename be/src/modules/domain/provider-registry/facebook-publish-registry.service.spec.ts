import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { FacebookPublishRegistryService } from "./facebook-publish-registry.service"
import type { FacebookPublishPort } from "./facebook-publish-ports.contracts"

describe("FacebookPublishRegistryService", () => {
    const build = async () => {
        const moduleRef = await Test.createTestingModule({ providers: [FacebookPublishRegistryService] }).compile()
        return moduleRef.get(FacebookPublishRegistryService)
    }

    it("starts with no provider and answers undefined for a key nobody registered", async () => {
        const registry = await build()

        expect(registry.all()).toEqual([])
        expect(registry.has("facebook")).toBe(false)
        expect(registry.of("facebook")).toBeUndefined()
    })

    it("finds a registered provider by its key, and a second registration under the key replaces the first", async () => {
        const registry = await build()
        const first = mock<FacebookPublishPort>({ provider: "facebook" })
        const second = mock<FacebookPublishPort>({ provider: "facebook" })

        registry.register(first)
        expect(registry.of("facebook")).toBe(first)
        registry.register(second)

        expect(registry.of("facebook")).toBe(second)
        expect(registry.all()).toHaveLength(1)
        expect(registry.all()[0]).toBe(second)
    })
})
