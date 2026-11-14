import { Test } from "@nestjs/testing"
import { wakeSources } from "@modules/domain/agent-work"
import { AgentInboundError, AgentInboundErrorCode } from "./errors/agent-inbound.error"
import { InboundAdapterRegistryService } from "./inbound-adapter-registry.service"
import type { InboundAdapter } from "./agent-inbound.contracts"

const build = async () => {
    const container = await Test.createTestingModule({ providers: [InboundAdapterRegistryService] }).compile()
    return container.get(InboundAdapterRegistryService)
}

const adapter = (key: string, over: Partial<InboundAdapter> = {}): InboundAdapter => ({
    key,
    authentication: "signature",
    trustOf: () => "outsider",
    awaitsAnswer: false,
    replyStep: null,
    doorStep: "door",
    priority: 25,
    maxAttempts: 3,
    ...over,
})

const codeOf = (run: () => unknown): unknown => {
    try {
        run()
        return null
    } catch (cause) {
        return cause instanceof AgentInboundError ? cause.code : cause
    }
}

describe("InboundAdapterRegistryService", () => {
    it("knows the three sources that existed before adapters as adapters, and no customer source any more", async () => {
        const registry = await build()

        expect(["tag", "internal", "schedule"].map((key) => registry.of(key).key)).toEqual(["tag", "internal", "schedule"])
        expect(registry.lookup("customer")).toBeUndefined()
    })

    it("adds an adapter by key and records its traits with the work core, so a wake of its key can be written", async () => {
        const registry = await build()
        const added = adapter("registry_spec_hook", { priority: 33 })

        registry.add(added)

        expect(registry.of("registry_spec_hook")).toBe(added)
        expect(registry.lookup("registry_spec_hook")).toBe(added)
        expect(wakeSources.of("registry_spec_hook").priority).toBe(33)
    })

    it("refuses a second adapter for a key, so a wiring bug fails at start", async () => {
        const registry = await build()

        expect(codeOf(() => registry.add(adapter("tag")))).toBe(AgentInboundErrorCode.AdapterDuplicate)
    })

    it("finds nothing for a key nobody registered and refuses to deliver its events", async () => {
        const registry = await build()

        expect(registry.lookup("registry_spec_nobody")).toBeUndefined()
        expect(codeOf(() => registry.of("registry_spec_nobody"))).toBe(AgentInboundErrorCode.AdapterUnknown)
    })

    it("lets a second registry in the same process add the same built-in sources without complaint", async () => {
        await build()

        await expect(build()).resolves.toBeInstanceOf(InboundAdapterRegistryService)
    })
})
