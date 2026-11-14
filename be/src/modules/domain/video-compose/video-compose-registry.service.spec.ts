import { Test } from "@nestjs/testing"
import { FAKE_COMPOSE, FakeComposePort } from "@tests/fixtures/builders/video-compose.builder"
import { VideoComposeRegistryService } from "./video-compose-registry.service"

describe("the compose registry", () => {
    it("answers a provider's port by its key, the last registration under a key winning, every port in order", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [VideoComposeRegistryService] }).compile()
        const registry = moduleRef.get(VideoComposeRegistryService)
        const first = new FakeComposePort(FAKE_COMPOSE)
        const second = new FakeComposePort(FAKE_COMPOSE)
        const other = new FakeComposePort("othercompose")
        registry.register(first)
        registry.register(other)
        registry.register(second)
        expect([registry.of(FAKE_COMPOSE), registry.of("othercompose"), registry.of("veo")]).toEqual([second, other, undefined])
        expect(registry.all()).toEqual([second, other])
    })
})
