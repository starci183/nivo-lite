import { Injectable } from "@nestjs/common"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectOpenclawAgentRegistry, InjectOpenclawGateway } from "@modules/integrations/openclaw"
import type { AgentRegistryService, GatewayClient } from "@modules/integrations/openclaw"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { EngineAvailability, EngineStatus, Processor, SyncCheckReader } from "./agents.contracts"
import { InjectAgentsOptions, InjectInstallations } from "./agents.decorators"
import type { AgentsOptions } from "./agents.options"
import type { InstallationDirectory } from "./agents.port"
import { EngineReadinessService } from "./engine-readiness.service"
import { isFresh, processorFromSettings } from "./engine-status.policy"

@Injectable()
/**
 * Whether the agent engine can answer. The engine worker, its heartbeat and the signed callbacks are gone: OpenClaw is called straight
 * from this process, so "online" means a gateway is configured and the agent workspaces can be written. The sync check time is the
 * liveness signal that remains (a scheduled sync touches it every few minutes).
 */
export class EngineStatusService {
    private readonly readiness: EngineReadinessService

    constructor(
        private readonly members: WorkspaceMembersService,
        @InjectInstallations() private readonly installations: InstallationDirectory,
        @InjectOpenclawGateway() gateway: GatewayClient,
        @InjectOpenclawAgentRegistry() registry: AgentRegistryService,
        @InjectClock() private readonly clock: Clock,
        @InjectAgentsOptions() private readonly options: AgentsOptions,
    ) {
        this.readiness = new EngineReadinessService(gateway, registry)
    }

    /** Whether a text can be generated now: no gateway, a gateway without a writable workspace, or ready. */
    availability(): EngineAvailability {
        return this.readiness.availability()
    }

    /** Who answers a module's customers in a workspace (its first installation; OpenClaw when it has none). */
    async processorOf(workspaceId: string, module: string): Promise<Processor> {
        const installation = await this.installations.firstOfModule(workspaceId, module)
        return processorFromSettings(installation?.settings)
    }

    /**
     * The engine status for the Agents page; any member may look. `lastSyncCheck` reads when the agent copies were last checked (the sync
     * capability owns that), and runs only after membership is proved.
     */
    async status(userId: string, workspaceId: string, lastSyncCheck: SyncCheckReader): Promise<EngineStatus> {
        await this.members.require(userId, workspaceId)
        const lastSyncCheckAt = await lastSyncCheck()
        return {
            gatewayConfigured: this.readiness.configured(),
            workspaceWritable: this.readiness.writable(),
            lastSyncCheckAt,
            syncFresh: isFresh(lastSyncCheckAt, this.clock.now().getTime(), this.options.syncFreshMs),
        }
    }
}
