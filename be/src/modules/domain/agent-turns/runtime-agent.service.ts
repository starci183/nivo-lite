import { Injectable } from "@nestjs/common"
import type { Installation } from "@modules/domain/agents"
import { AgentSyncService } from "@modules/domain/openclaw-agent-sync"
import { InjectOpenclawAgentRegistry, agentIdFor } from "@modules/integrations/openclaw"
import type { AgentRegistryService } from "@modules/integrations/openclaw"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentTurnsLogEvent } from "./agent-turns.log-events"

/** What picking the runtime agent needs, so a caller that is not a Nest provider can use it as well. */
export interface RuntimeAgentDeps {
    /** Knows which agents the runtime holds. */
    readonly registry: Pick<AgentRegistryService, "has">
    /** Builds an agent's copy and the workspace's internal agent. */
    readonly sync: Pick<AgentSyncService, "syncInstallation" | "ensureInternalAgent">
    /** Where a failed sync of an installation is logged. */
    readonly logger: Logger
}

/** The installation of an agent, or null when it has none. */
export type OptionalInstallation = Installation | null

/**
 * The runtime agent a turn of this module runs on: the module's own agent when the runtime already knows it; otherwise its copy is built
 * now. When that cannot be done, the turn runs on the workspace's internal agent with the complete context the caller prepared.
 */
export const runtimeAgentFor = async (
    deps: RuntimeAgentDeps,
    workspaceId: string,
    module: string,
    installation: OptionalInstallation,
): Promise<string> => {
    const own = agentIdFor(workspaceId, module)
    if (deps.registry.has(own)) return own
    if (installation !== null) {
        try {
            const synced = await deps.sync.syncInstallation(workspaceId, installation.id, true)
            if (synced !== null) return synced.agentId
        } catch (cause) {
            deps.logger.error(AgentTurnsLogEvent.AgentSyncFailed, cause, { installationId: installation.id })
        }
    }
    return deps.sync.ensureInternalAgent(workspaceId)
}

@Injectable()
/** Picks the runtime agent of a turn for the handlers of the core road. */
export class RuntimeAgentService {
    constructor(
        @InjectOpenclawAgentRegistry() private readonly registry: AgentRegistryService,
        @InjectLogger() private readonly logger: Logger,
        private readonly sync: AgentSyncService,
    ) {}

    /** The runtime agent a turn of the module runs on. */
    agentFor(workspaceId: string, module: string, installation: OptionalInstallation): Promise<string> {
        return runtimeAgentFor(
            {
                registry: this.registry,
                sync: this.sync,
                logger: this.logger,
            },
            workspaceId,
            module,
            installation,
        )
    }
}
