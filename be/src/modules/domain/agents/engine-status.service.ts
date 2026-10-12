import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { AgentRegistryService, GatewayClient } from "@modules/integrations/openclaw"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { EngineAvailability, EngineStatus, Processor } from "./agents.contracts"
import { InjectAgentsOptions, InjectInstallations } from "./agents.decorators"
import type { AgentsOptions } from "./agents.options"
import type { InstallationDirectory } from "./agents.port"
import { isFresh, processorFromSettings } from "./engine-status.policy"
import type { SyncCheckRow } from "./persistence/openclaw-agent-sync.rows"
import { FIND_LAST_SYNC_CHECK } from "./persistence/openclaw-agent-sync.sql"

/** Any agent id works for the probe: only whether a config directory is set matters. */
const PROBE_AGENT = "probe"

@Injectable()
/**
 * Whether the agent engine can answer. The engine worker, its heartbeat and the signed callbacks are gone: OpenClaw is called straight
 * from this process, so "online" means a gateway is configured and the agent workspaces can be written. The sync check time is the
 * liveness signal that remains (a scheduled sync touches it every few minutes).
 */
export class EngineStatusService {
    constructor(
        @InjectAgentsOptions() private readonly options: AgentsOptions,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectInstallations() private readonly installations: InstallationDirectory,
        private readonly gateway: GatewayClient,
        private readonly registry: AgentRegistryService,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** Whether a text can be generated now: no gateway, a gateway without a writable workspace, or ready. */
    availability(): EngineAvailability {
        if (!this.gateway.enabled) return "not_configured"
        return this.registry.workspaceDirs(PROBE_AGENT) === null ? "offline" : "ready"
    }

    /** Who answers a module's customers in a workspace (its first installation; OpenClaw when it has none). */
    async processorOf(workspaceId: string, module: string): Promise<Processor> {
        const installation = await this.installations.firstOfModule(workspaceId, module)
        return processorFromSettings(installation?.settings)
    }

    /** The engine status for the Agents page; any member may look. */
    async status(userId: string, workspaceId: string): Promise<EngineStatus> {
        await this.members.require(userId, workspaceId)
        const [row] = await this.entityManager.query<Array<SyncCheckRow>>(FIND_LAST_SYNC_CHECK, [workspaceId])
        const lastSyncCheckAt = row?.checked_at ?? null
        return {
            gatewayConfigured: this.gateway.enabled,
            workspaceWritable: this.registry.workspaceDirs(PROBE_AGENT) !== null,
            lastSyncCheckAt,
            syncFresh: isFresh(lastSyncCheckAt, this.clock.now().getTime(), this.options.syncFreshMs),
        }
    }
}
