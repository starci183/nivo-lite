import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { IntentRegistryService } from "@modules/domain/intent-contracts"
import { TEST_DOMAIN } from "@tests/fixtures/builders/intent-domain.builder"
import { AgentPluginsErrorCode } from "./errors/agent-plugins.error"
import { AgentPluginsService } from "./agent-plugins.service"

const build = async () => {
    const intents = mock<IntentRegistryService>({ add: jest.fn() })
    const moduleRef = await Test.createTestingModule({
        providers: [AgentPluginsService, { provide: IntentRegistryService, useValue: intents }],
    }).compile()
    return { service: moduleRef.get(AgentPluginsService), intents }
}

const codeOf = (work: () => void): unknown => {
    try {
        work()
        return null
    } catch (cause) {
        return typeof cause === "object" && cause !== null && "code" in cause ? cause.code : cause
    }
}

describe("AgentPluginsService.add", () => {
    it("fans a manifest out to the registry of intents", async () => {
        const { service, intents } = await build()

        service.add({
            key: "shop",
            contracts: TEST_DOMAIN.frames,
            results: TEST_DOMAIN.results,
            checks: TEST_DOMAIN.checks,
        })

        expect(intents.add).toHaveBeenCalledWith({
            frames: TEST_DOMAIN.frames,
            results: TEST_DOMAIN.results,
            checks: TEST_DOMAIN.checks,
        })
    })

    it("takes a manifest that brings only a part", async () => {
        const { service, intents } = await build()

        service.add({ key: "bare" })

        expect(intents.add).toHaveBeenCalledWith({ frames: [], results: {}, checks: {} })
    })

    it("throws on a second manifest under the same key and registers nothing of it", async () => {
        const { service, intents } = await build()
        service.add({ key: "shop" })

        expect(codeOf(() => service.add({ key: "shop", contracts: TEST_DOMAIN.frames }))).toBe(
            AgentPluginsErrorCode.KeyDuplicate,
        )
        expect(intents.add).toHaveBeenCalledTimes(1)
    })
})
