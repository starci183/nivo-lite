import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { OPENCLAW_AGENT_REGISTRY, OPENCLAW_GATEWAY } from "@modules/integrations/openclaw"
import type { AgentRegistryService, GatewayClient } from "@modules/integrations/openclaw"
import { EngineReadinessService } from "./engine-readiness.service"

const build = async (enabled: boolean, writable: boolean) => {
    const configured = jest.fn(() => enabled)
    const gateway = mock<GatewayClient>({})
    Object.defineProperty(gateway, "enabled", { get: configured })
    const registry = mock<AgentRegistryService>({
        workspaceDirs: jest.fn(() => (writable ? { local: "/local", gateway: "/gateway" } : null)),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            EngineReadinessService,
            { provide: OPENCLAW_GATEWAY, useValue: gateway },
            { provide: OPENCLAW_AGENT_REGISTRY, useValue: registry },
        ],
    }).compile()
    return { service: moduleRef.get(EngineReadinessService), configured, registry }
}

describe("EngineReadinessService", () => {
    it("reads the current gateway configuration each time it is requested", async () => {
        const { service, configured } = await build(false, true)

        expect(service.configured()).toBe(false)
        configured.mockReturnValueOnce(true)
        expect(service.configured()).toBe(true)
        expect(configured).toHaveBeenCalledTimes(2)
    })

    it("probes the current workspace directory each time readiness is requested", async () => {
        const { service, registry } = await build(true, true)

        expect(service.writable()).toBe(true)
        registry.workspaceDirs.mockReturnValueOnce(null)
        expect(service.writable()).toBe(false)
        expect(registry.workspaceDirs).toHaveBeenNthCalledWith(1, "probe")
        expect(registry.workspaceDirs).toHaveBeenNthCalledWith(2, "probe")
    })

    it("does not probe workspaces before a gateway is configured", async () => {
        const { service, configured, registry } = await build(false, true)

        expect(service.availability()).toBe("not_configured")
        expect(configured).toHaveBeenCalledTimes(1)
        expect(registry.workspaceDirs).not.toHaveBeenCalled()
    })

    it.each([
        { writable: false, availability: "offline" },
        { writable: true, availability: "ready" },
    ])(
        "answers $availability after checking configuration and workspace readiness",
        async ({ writable, availability }) => {
            const { service, configured, registry } = await build(true, writable)

            expect(service.availability()).toBe(availability)
            expect(configured).toHaveBeenCalledTimes(1)
            expect(registry.workspaceDirs).toHaveBeenCalledTimes(1)
            expect(configured.mock.invocationCallOrder[0]).toBeLessThan(
                registry.workspaceDirs.mock.invocationCallOrder[0] ?? 0,
            )
        },
    )
})
