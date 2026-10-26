import { Injectable } from "@nestjs/common"
import { AgentsService } from "@modules/domain/agents"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { ModuleInstallService } from "./module-install.service"

const GOVERNORS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

@Injectable()
/**
 * Pauses or resumes an agent by the agent id, the door of the agent list and the agent page. An agent that an installation drives
 * follows the live switch of that installation, so the installation and its agent never disagree and the version guard holds on
 * every door; an agent without an installation is paused or resumed alone. Owners and managers only.
 */
export class AgentActivationService {
    constructor(
        private readonly installations: InstallationRecordsService,
        private readonly installs: ModuleInstallService,
        private readonly agents: AgentsService,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** Resumes (`active`) or pauses the agent. */
    async setActive(principalId: string, workspaceId: string, agentId: string, active: boolean): Promise<void> {
        await this.members.require(principalId, workspaceId, GOVERNORS)
        const installation = await this.installations.ofAgent(workspaceId, agentId)
        if (installation === null) {
            await this.agents.setStatus(principalId, workspaceId, agentId, active)
            return
        }
        await this.installs.setLive(principalId, workspaceId, installation.id, active)
    }
}
