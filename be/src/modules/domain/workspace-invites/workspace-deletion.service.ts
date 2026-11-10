import { Injectable } from "@nestjs/common"
import { AgentDeletionPauseService } from "@modules/domain/agents"
import { WorkspaceLobbyService } from "@modules/domain/workspaces"
import { MyInvitesService } from "./my-invites.service"

@Injectable()
/**
 * The owner's deletion of a workspace, a soft delete, and its restore within the window. Deleting turns every seat off, pauses every
 * running agent (so no event wakes one) and revokes the pending invitations; restoring turns on and resumes exactly what the deletion
 * turned off. Revoked invitations stay revoked.
 */
export class WorkspaceDeletionService {
    constructor(
        private readonly lobby: WorkspaceLobbyService,
        private readonly agents: AgentDeletionPauseService,
        private readonly invites: MyInvitesService,
    ) {}

    /** Deletes the workspace as its owner, who typed its name, then pauses its agents and revokes its pending invitations. */
    async remove(userId: string, workspaceId: string, confirmName: string): Promise<void> {
        await this.lobby.remove(userId, workspaceId, confirmName)
        await this.agents.pauseAll(workspaceId)
        await this.invites.revokeAllOf(workspaceId)
    }

    /** Restores the workspace as its owner within the window, then resumes the agents the deletion paused. */
    async restore(userId: string, workspaceId: string): Promise<void> {
        await this.lobby.restore(userId, workspaceId)
        await this.agents.resumeAll(workspaceId)
    }
}
