import { Injectable } from "@nestjs/common"
import { AgentBindingsService, type OptionalResumeKeep } from "@modules/domain/agent-connections"
import { AgentDirectoryService, AgentsService } from "@modules/domain/agents"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkspaceMembersService, type WorkspaceRole } from "@modules/domain/workspace-members"
import type { InstallationView } from "./modules.contracts"
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
        private readonly bindings: AgentBindingsService,
        private readonly directory: AgentDirectoryService,
    ) {}

    /**
     * Resumes (`active`) or pauses the agent. A resume that would give a channel two agents of one role is refused with a conflict that
     * lists the channels, unless `keep` says whom to keep: "resumed" (this agent takes the channels) or "current" (the agent that answers
     * them now keeps them and this one drops them).
     */
    async setActive(
        principalId: string,
        workspaceId: string,
        agentId: string,
        active: boolean,
        keep: OptionalResumeKeep = null,
    ): Promise<void> {
        await this.members.require(principalId, workspaceId, GOVERNORS)
        const conflicts = active ? await this.channelConflictsOf(workspaceId, agentId, keep) : []
        const installation = await this.installations.ofAgent(workspaceId, agentId)
        if (installation === null) {
            await this.agents.setStatus(principalId, workspaceId, agentId, active)
        } else {
            await this.installs.setLive(principalId, workspaceId, installation.id, active)
        }
        await this.bindings.settleResume(workspaceId, agentId, conflicts, keep)
    }

    /**
     * The same switch from the agent page, which names the installation: resumes (`live`) or pauses it, with the same channel check and
     * the same choice of whom to keep. Answers the installation as the page shows it.
     */
    async setInstallationLive(
        principalId: string,
        workspaceId: string,
        installationId: string,
        live: boolean,
        keep: OptionalResumeKeep = null,
    ): Promise<InstallationView> {
        await this.members.require(principalId, workspaceId, GOVERNORS)
        const installation = await this.installations.find(workspaceId, installationId)
        const agentId = installation?.agentId ?? null
        const conflicts = live && agentId !== null ? await this.channelConflictsOf(workspaceId, agentId, keep) : []
        const view = await this.installs.setLive(principalId, workspaceId, installationId, live)
        if (agentId !== null) await this.bindings.settleResume(workspaceId, agentId, conflicts, keep)
        return view
    }

    /** The channels the agent shares with another agent of its role once active; refused when the caller has not chosen. */
    private async channelConflictsOf(workspaceId: string, agentId: string, keep: OptionalResumeKeep) {
        const [card] = await this.directory.cardsOf(workspaceId, [agentId])
        if (card === undefined) return []
        return this.bindings.requireResumeChoice(workspaceId, card, keep)
    }
}
