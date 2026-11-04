import { Test } from "@nestjs/testing"
import { PollSourceRegistryService } from "./poll-source-registry.service"
import type { PollSourceDirectory, ScheduledPollSource } from "./poll-schedule.contracts"

const sourceOf = (provider: string): ScheduledPollSource => ({
    provider,
    limits: { ratePerSecond: 1, burst: 1, concurrency: 1 },
    poller: { provider, fetch: jest.fn(), store: jest.fn() },
    classify: () => ({ kind: "fatal" }),
})

const directoryOf = (...providers: Array<string>): PollSourceDirectory => ({
    providers: () => providers,
    sourceOf: (provider) => (providers.includes(provider) ? sourceOf(provider) : undefined),
})

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [PollSourceRegistryService] }).compile()
    return moduleRef.get(PollSourceRegistryService)
}

describe("PollSourceRegistryService", () => {
    it("lists the providers of every capability once", async () => {
        const registry = await build()
        registry.add(directoryOf("sepay", "casso"))
        registry.add(directoryOf("zalo_oa", "sepay"))

        expect(registry.providers()).toEqual(["sepay", "casso", "zalo_oa"])
    })

    it("finds the source of a provider in whichever capability has it", async () => {
        const registry = await build()
        registry.add(directoryOf("sepay"))
        registry.add(directoryOf("zalo_oa"))

        expect(registry.sourceOf("zalo_oa")?.provider).toBe("zalo_oa")
        expect(registry.sourceOf("telegram")).toBeUndefined()
    })

    it("knows nothing before a capability adds its directory", async () => {
        const registry = await build()

        expect(registry.providers()).toEqual([])
        expect(registry.sourceOf("sepay")).toBeUndefined()
    })
})
