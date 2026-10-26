import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentsService } from "@modules/domain/agents"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { EventsService } from "@modules/domain/events"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { AgentSyncService } from "@modules/domain/openclaw-agent-sync"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ModulesError, ModulesErrorCode } from "./errors/modules.error"
import { ModuleReadinessService } from "./module-readiness.service"
import type { InstallationView } from "./modules.contracts"

const GOVERNORS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

@Injectable()
/**
 * Removes an installed agent (the uninstall): terminal and soft. Its conversations, messages, context versions and knowledge stay for
 * history; it stops at once (no customer turns, its agent is paused, its own authority grants are switched off), leaves every list,
 * and goes from OpenClaw on the sync this queues. Installing the role again makes a new installation. Owners and managers only.
 */
export class AgentRemovalService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly installations: InstallationRecordsService,
        private readonly members: WorkspaceMembersService,
        private readonly agents: AgentsService,
        private readonly rules: AuthorityRulesService,
        private readonly events: EventsService,
        private readonly sync: AgentSyncService,
        private readonly readiness: ModuleReadinessService,
    ) {}

    /** Removes the installation; removing one that is already removed changes nothing. Answers the installation as it is now. */
    async remove(principalId: string, workspaceId: string, installationId: string): Promise<InstallationView> {
        const member = await this.members.require(principalId, workspaceId, GOVERNORS)
        const current = await this.installations.find(workspaceId, installationId)
        if (current === null) throw new ModulesError({ code: ModulesErrorCode.InstallationNotFound })
        if (current.status === "removed") return this.readiness.withNeeds(current)
        await this.entityManager.transaction(async (tx) => {
            await this.installations.markRemoved(workspaceId, installationId, member.displayName, tx)
            if (current.agentId !== null) {
                await this.agents.setStatus(principalId, workspaceId, current.agentId, false, tx)
                await this.rules.disableForAgent(workspaceId, current.agentId, tx)
            }
        })
        await this.events.record({
            workspaceId,
            kind: "module.removed",
            actor: member.displayName,
            summary: `${member.displayName}: ${current.moduleKey}${current.isMulti ? " - " + current.name : ""}`,
        })
        await this.sync.requestNow({ workspaceId, installationId, force: false })
        const removed = await this.installations.find(workspaceId, installationId)
        if (removed === null) throw new ModulesError({ code: ModulesErrorCode.InstallationNotFound })
        return this.readiness.withNeeds(removed)
    }
}
