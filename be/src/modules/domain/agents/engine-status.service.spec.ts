import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { OPENCLAW_AGENT_REGISTRY, OPENCLAW_GATEWAY } from "@modules/integrations/openclaw"
import type { AgentRegistryService, GatewayClient } from "@modules/integrations/openclaw"
import { CLOCK } from "@modules/platform/clock"
import { AGENTS_INSTALLATIONS, AGENTS_OPTIONS } from "./agents.decorators"
import type { AgentsOptions } from "./agents.options"
import type { Installation, InstallationDirectory } from "./agents.port"
import { EngineStatusService } from "./engine-status.service"

const OPTIONS: Omit<AgentsOptions, "ports"> = { syncFreshMs: 600_000 }

/** What a spec sets up around the service. */
interface Setup {
    enabled: boolean
    dirs: boolean
    checkedAt?: string | null
    installation?: Installation | null
}

const build = async (setup: Setup) => {
    const gateway = mock<GatewayClient>({})
    Object.defineProperty(gateway, "enabled", { value: setup.enabled })
    const registry = mock<AgentRegistryService>({
        workspaceDirs: jest.fn(() => (setup.dirs ? { local: "/c", gateway: "/g" } : null)),
    })
    const members = mock<WorkspaceMembersService>()
    const installations = mock<InstallationDirectory>({
        firstOfModule: jest.fn(() => Promise.resolve(setup.installation ?? null)),
    })
    const lastSyncCheck = jest.fn(() => Promise.resolve(setup.checkedAt ?? null))
    const moduleRef = await Test.createTestingModule({
        providers: [
            EngineStatusService,
            { provide: AGENTS_OPTIONS, useValue: OPTIONS },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T10:00:00.000Z") },
            { provide: AGENTS_INSTALLATIONS, useValue: installations },
            { provide: OPENCLAW_GATEWAY, useValue: gateway },
            { provide: OPENCLAW_AGENT_REGISTRY, useValue: registry },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(EngineStatusService), lastSyncCheck, members, installations }
}

describe("EngineStatusService", () => {
    describe("availability", () => {
        it("is not configured without a gateway", async () => {
            const { service } = await build({ enabled: false, dirs: true })

            expect(service.availability()).toBe("not_configured")
        })

        it("is offline when the agent workspaces cannot be written", async () => {
            const { service } = await build({ enabled: true, dirs: false })

            expect(service.availability()).toBe("offline")
        })

        it("is ready with a gateway and a writable workspace", async () => {
            const { service } = await build({ enabled: true, dirs: true })

            expect(service.availability()).toBe("ready")
        })
    })

    describe("processorOf", () => {
        it("reads the processor of the first installation of the module", async () => {
            const installation: Installation = {
                id: "i1",
                workspaceId: "w1",
                module: "chatbot",
                name: "Chatbot",
                isMulti: false,
                agentId: null,
                operatingMode: "assist",
                settings: { processor: "nivo" },
                activeContextVersionId: null,
                liveEnabled: false,
                removed: false,
            }
            const { service, installations } = await build({ enabled: true, dirs: true, installation })

            await expect(service.processorOf("w1", "chatbot")).resolves.toBe("nivo")
            expect(installations.firstOfModule).toHaveBeenCalledWith("w1", "chatbot")
        })

        it("answers OpenClaw for a module with no installation", async () => {
            const { service } = await build({ enabled: true, dirs: true })

            await expect(service.processorOf("w1", "chatbot")).resolves.toBe("openclaw")
        })
    })
})

describe("EngineStatusService", () => {
    describe("status", () => {
        it("reports a configured engine whose sync checked in recently", async () => {
            const { service, members, lastSyncCheck } = await build({
                enabled: true,
                dirs: true,
                checkedAt: "2026-10-12T09:55:00.000Z",
            })

            await expect(service.status("u1", "w1", lastSyncCheck)).resolves.toEqual({
                gatewayConfigured: true,
                workspaceWritable: true,
                lastSyncCheckAt: "2026-10-12T09:55:00.000Z",
                syncFresh: true,
            })
            expect(members.require).toHaveBeenCalledWith("u1", "w1")
            expect(lastSyncCheck).toHaveBeenCalledTimes(1)
        })

        it("reports a stale or missing sync check", async () => {
            const stale = await build({ enabled: false, dirs: false, checkedAt: "2026-10-12T08:00:00.000Z" })
            const never = await build({ enabled: false, dirs: false })

            await expect(stale.service.status("u1", "w1", stale.lastSyncCheck)).resolves.toMatchObject({
                gatewayConfigured: false,
                workspaceWritable: false,
                syncFresh: false,
            })
            await expect(never.service.status("u1", "w1", never.lastSyncCheck)).resolves.toMatchObject({
                lastSyncCheckAt: null,
                syncFresh: false,
            })
        })
    })
})
