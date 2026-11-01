import { Injectable } from "@nestjs/common"
import { AgentDirectoryService } from "@modules/domain/agents"
import { McpGatewayService } from "@modules/domain/mcp-gateway"
import { ContextVersionsService } from "@modules/domain/module-context-versions"
import { InstallationRecordsService, lifecycleOf } from "@modules/domain/module-installations"
import { SetupSessionsService } from "@modules/domain/module-setup-sessions"
import type { InstallationRecord, InstallationStatus } from "@modules/domain/module-installations"
import { ModulesError, ModulesErrorCode } from "./errors/modules.error"
import type { ConnectionNeed, InstallationView } from "./modules.contracts"
import { ModulesService } from "./modules.service"
import { setupProgressOf } from "./policies/setup-gates.policy"

@Injectable()
/**
 * Whether the connections an installed agent requires are there: its module's required capability roles, each played by a usable
 * connector of the workspace (through the gateway, never a named connector). Without them an applied agent waits in
 * `needs_connection` and does not run; with them it is live again.
 */
export class ModuleReadinessService {
    constructor(
        private readonly installations: InstallationRecordsService,
        private readonly catalog: ModulesService,
        private readonly gateway: McpGatewayService,
        private readonly agents: AgentDirectoryService,
        private readonly versions: ContextVersionsService,
        private readonly sessions: SetupSessionsService,
    ) {}

    /** The required roles of a module that the workspace cannot play now, each with the connectors that could play it. */
    async needsOf(workspaceId: string, moduleKey: string): Promise<ReadonlyArray<ConnectionNeed>> {
        const module = await this.catalog.find(moduleKey)
        const required = module.requires.roles?.requires ?? []
        if (required.length === 0) return []
        const readiness = await this.gateway.readiness(workspaceId, required)
        return readiness.missing.map((role) => ({ role, providers: readiness.providers[role] }))
    }

    /** An installation with its agent, the number of its active version, how far its setup got and what it still needs connected. */
    async withNeeds(record: InstallationRecord): Promise<InstallationView> {
        const [connectionNeeds, [identity], [version], module, session] = await Promise.all([
            this.needsOf(record.workspaceId, record.moduleKey),
            this.agents.identitiesOf(record.workspaceId, record.agentId === null ? [] : [record.agentId]),
            this.versions.numbersOf(record.activeContextVersionId === null ? [] : [record.activeContextVersionId]),
            this.catalog.find(record.moduleKey),
            this.sessions.latest(record.id),
        ])
        const setupProgress = setupProgressOf(module, session?.gateEvidence ?? {})
        return {
            ...record,
            agentName: identity?.name ?? "",
            agentHandle: identity?.handle ?? record.moduleKey,
            agentAvatarUrl: identity?.avatarUrl ?? null,
            activeVersion: version?.version ?? null,
            connectionNeeds,
            lifecycle: lifecycleOf(record, connectionNeeds.length, setupProgress.confirmed),
            setupProgress,
        }
    }

    /**
     * Checks an installation before its agent runs (and right after it is applied): a ready or live one without its required
     * connections waits in `needs_connection`, a waiting one with them is live again. Answers the status it is in now; the agent
     * runs only when that is `live` or `ready`.
     */
    async settle(workspaceId: string, installationId: string): Promise<InstallationStatus> {
        const installation = await this.installations.find(workspaceId, installationId)
        if (installation === null) throw new ModulesError({ code: ModulesErrorCode.InstallationNotFound })
        const needs = await this.needsOf(workspaceId, installation.moduleKey)
        const moved = await this.installations.settleConnection(workspaceId, installation.id, needs.length === 0)
        return moved ?? installation.status
    }
}
