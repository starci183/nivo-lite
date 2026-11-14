import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TiktokPublishRegistryService } from "./tiktok-publish-registry.service"
import type { TiktokPublishPort } from "./tiktok-publish-ports.contracts"

describe("TiktokPublishRegistryService", () => {
    const build = async () => {
        const moduleRef = await Test.createTestingModule({ providers: [TiktokPublishRegistryService] }).compile()
        return moduleRef.get(TiktokPublishRegistryService)
    }

    it("starts with no provider and answers undefined for a key nobody registered", async () => {
        const registry = await build()

        expect(registry.all()).toEqual([])
        expect(registry.has("tiktok")).toBe(false)
        expect(registry.of("tiktok")).toBeUndefined()
    })

    it("finds a registered provider by its key, and a second registration under the key replaces the first", async () => {
        const registry = await build()
        const first = mock<TiktokPublishPort>({ provider: "tiktok" })
        const second = mock<TiktokPublishPort>({ provider: "tiktok" })

        registry.register(first)
        expect(registry.of("tiktok")).toBe(first)
        registry.register(second)

        expect(registry.of("tiktok")).toBe(second)
        expect(registry.all()).toHaveLength(1)
        expect(registry.all()[0]).toBe(second)
    })
})
