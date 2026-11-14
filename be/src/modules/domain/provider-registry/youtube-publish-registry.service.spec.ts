import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { YoutubePublishRegistryService } from "./youtube-publish-registry.service"
import type { YoutubePublishPort } from "./youtube-publish-ports.contracts"

describe("YoutubePublishRegistryService", () => {
    const build = async () => {
        const moduleRef = await Test.createTestingModule({ providers: [YoutubePublishRegistryService] }).compile()
        return moduleRef.get(YoutubePublishRegistryService)
    }

    it("starts with no provider and answers undefined for a key nobody registered", async () => {
        const registry = await build()

        expect(registry.all()).toEqual([])
        expect(registry.has("youtube")).toBe(false)
        expect(registry.of("youtube")).toBeUndefined()
    })

    it("finds a registered provider by its key, and a second registration under the key replaces the first", async () => {
        const registry = await build()
        const first = mock<YoutubePublishPort>({ provider: "youtube" })
        const second = mock<YoutubePublishPort>({ provider: "youtube" })

        registry.register(first)
        expect(registry.of("youtube")).toBe(first)
        registry.register(second)

        expect(registry.of("youtube")).toBe(second)
        expect(registry.all()).toHaveLength(1)
        expect(registry.all()[0]).toBe(second)
    })
})
