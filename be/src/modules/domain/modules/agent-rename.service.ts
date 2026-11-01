import { Injectable } from "@nestjs/common"
import { AgentIdentityService } from "@modules/domain/agents"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { InstallationChangesService } from "./installation-changes.service"

@Injectable()
/** Renames an agent from its profile by the agent's id, then tells the sync so the OpenClaw copy of its installation carries the new name. */
export class AgentRenameService {
    constructor(
        private readonly identity: AgentIdentityService,
        private readonly installations: InstallationRecordsService,
        private readonly changes: InstallationChangesService,
    ) {}

    /** Renames the agent (a manager only, the name held to its limits); an agent no installation drives needs no sync. */
    async rename(principalId: string, workspaceId: string, agentId: string, name: string): Promise<void> {
        await this.identity.rename(principalId, workspaceId, agentId, name)
        const installation = await this.installations.ofAgent(workspaceId, agentId)
        if (installation === null) return
        await this.changes.announceNow({ workspaceId, installationId: installation.id, force: false })
    }
}
