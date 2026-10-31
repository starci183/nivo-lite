import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { Installation } from "@modules/domain/agents"
import { AgentSyncService } from "@modules/domain/openclaw-agent-sync"
import { OPENCLAW_AGENT_REGISTRY, agentIdFor } from "@modules/integrations/openclaw"
import type { AgentRegistryService } from "@modules/integrations/openclaw"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentTurnsLogEvent } from "./agent-turns.log-events"
import { RuntimeAgentService } from "./runtime-agent.service"

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111"
const MODULE = "chatbot"
const installation = mock<Installation>({ id: "inst-1" })
const SYNCED = {
    agentId: "synced-agent",
    contextVersion: 3,
    changed: true,
    written: 4,
    removed: 0,
    registered: false,
    files: 6,
    contentHash: "h",
}

const build = async (known: boolean) => {
    const registry = mock<AgentRegistryService>({ has: jest.fn(() => known) })
    const sync = mock<AgentSyncService>({
        syncInstallation: jest.fn(() => Promise.resolve(SYNCED)),
        ensureInternalAgent: jest.fn(() => Promise.resolve("internal-agent")),
    })
    const logger = mock<Logger>({ error: jest.fn() })
    const moduleRef = await Test.createTestingModule({
        providers: [
            RuntimeAgentService,
            { provide: OPENCLAW_AGENT_REGISTRY, useValue: registry },
            { provide: AgentSyncService, useValue: sync },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(RuntimeAgentService), registry, sync, logger }
}

describe("RuntimeAgentService.agentFor", () => {
    it("uses the module's own agent when the runtime already knows it", async () => {
        const { service, sync } = await build(true)

        await expect(service.agentFor(WORKSPACE_ID, MODULE, installation)).resolves.toBe(
            agentIdFor(WORKSPACE_ID, MODULE),
        )
        expect(sync.syncInstallation).not.toHaveBeenCalled()
    })

    it("builds the copy of the installation when the runtime does not know the agent yet", async () => {
        const { service, sync } = await build(false)

        await expect(service.agentFor(WORKSPACE_ID, MODULE, installation)).resolves.toBe("synced-agent")
        expect(sync.syncInstallation).toHaveBeenCalledWith(WORKSPACE_ID, "inst-1", true)
    })

    it("runs on the workspace's internal agent when there is no installation", async () => {
        const { service, sync } = await build(false)

        await expect(service.agentFor(WORKSPACE_ID, MODULE, null)).resolves.toBe("internal-agent")
        expect(sync.syncInstallation).not.toHaveBeenCalled()
    })

    it("runs on the internal agent when the installation is gone", async () => {
        const { service, sync } = await build(false)
        sync.syncInstallation.mockResolvedValue(null)

        await expect(service.agentFor(WORKSPACE_ID, MODULE, installation)).resolves.toBe("internal-agent")
    })

    it("logs a failed sync and runs on the internal agent", async () => {
        const { service, sync, logger } = await build(false)
        const cause = new Error("sync down")
        sync.syncInstallation.mockRejectedValue(cause)

        await expect(service.agentFor(WORKSPACE_ID, MODULE, installation)).resolves.toBe("internal-agent")
        expect(logger.error).toHaveBeenCalledWith(AgentTurnsLogEvent.AgentSyncFailed, cause, {
            installationId: "inst-1",
        })
    })

    it("lets a failure of the internal agent itself reach the caller", async () => {
        const { service, sync } = await build(false)
        const cause = new Error("no workspace")
        sync.ensureInternalAgent.mockRejectedValue(cause)

        await expect(service.agentFor(WORKSPACE_ID, MODULE, null)).rejects.toBe(cause)
    })
})
