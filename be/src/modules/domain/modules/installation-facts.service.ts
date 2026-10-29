import { Injectable } from "@nestjs/common"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionsService } from "@modules/domain/connections"
import { ContextVersionsService } from "@modules/domain/module-context-versions"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { AgentSyncState, OptionalAgentSyncStatus, RequirementFacts } from "@modules/domain/module-installations"
import { AgentSyncReadService } from "@modules/domain/openclaw-agent-sync"
import { StaffDirectoryService } from "@modules/domain/staff"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"

/** How many connected providers are read at once. */
const PROVIDERS_LIMIT = 200

/** The departments whose active agents count as chat agents. */
const CHAT_MODULES: ReadonlyArray<string> = ["chatbot", "booking"]

/** The state a stored sync status reads as: a known one, or none. */
const stateOf = (status: string | undefined): AgentSyncState =>
    status === "ok" || status === "error" ? status : "none"

@Injectable()
/** What surrounds an installation and lives in other capabilities, asked of each owner: what the workspace has for a module's requirements, and where the OpenClaw copy of an agent stands. */
export class InstallationFactsService {
    constructor(
        private readonly installations: InstallationRecordsService,
        private readonly versions: ContextVersionsService,
        private readonly copies: AgentSyncReadService,
        private readonly connections: ConnectionsService,
        private readonly agents: AgentDirectoryService,
        private readonly staff: StaffDirectoryService,
        private readonly members: WorkspaceMembersReadService,
    ) {}

    /** What the workspace has for the requirements of a module: connected providers and head counts. */
    async requirementFacts(workspaceId: string): Promise<RequirementFacts> {
        const [providers, chatAgents, staff, members] = await Promise.all([
            this.connections.connectedProviders(workspaceId, PROVIDERS_LIMIT),
            this.agents.activeCountOfModules(workspaceId, CHAT_MODULES),
            this.staff.activeCount(workspaceId),
            this.members.activeCount(workspaceId),
        ])
        return { providers, chatAgents, staff, members }
    }

    /** Where the OpenClaw copy of the agent of an installation stands; null when the installation is not of the workspace. */
    async syncStatus(workspaceId: string, installationId: string): Promise<OptionalAgentSyncStatus> {
        const installation = await this.installations.find(workspaceId, installationId)
        if (installation === null) return null
        const versionIds = installation.activeContextVersionId === null ? [] : [installation.activeContextVersionId]
        const [numbers, copy] = await Promise.all([
            this.versions.numbersOf(versionIds),
            this.copies.copyOf(installationId),
        ])
        return {
            state: stateOf(copy?.status),
            syncedVersion: copy?.contextVersion ?? null,
            activeVersion: numbers[0]?.version ?? null,
            checkedAt: copy?.checkedAt.toISOString() ?? null,
            error: copy?.error ?? null,
        }
    }
}
