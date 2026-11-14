import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { InstagramPublishRegistryService } from "./instagram-publish-registry.service"
import type { InstagramPublishPort } from "./instagram-publish-ports.contracts"

describe("InstagramPublishRegistryService", () => {
    const build = async () => {
        const moduleRef = await Test.createTestingModule({ providers: [InstagramPublishRegistryService] }).compile()
        return moduleRef.get(InstagramPublishRegistryService)
    }

    it("starts with no provider and answers undefined for a key nobody registered", async () => {
        const registry = await build()

        expect(registry.all()).toEqual([])
        expect(registry.has("instagram")).toBe(false)
        expect(registry.of("instagram")).toBeUndefined()
    })

    it("finds a registered provider by its key, and a second registration under the key replaces the first", async () => {
        const registry = await build()
        const first = mock<InstagramPublishPort>({ provider: "instagram" })
        const second = mock<InstagramPublishPort>({ provider: "instagram" })

        registry.register(first)
        expect(registry.of("instagram")).toBe(first)
        registry.register(second)

        expect(registry.of("instagram")).toBe(second)
        expect(registry.all()).toHaveLength(1)
        expect(registry.all()[0]).toBe(second)
    })
})
