import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { AGENT_DISPLAY_NAME_LIMITS, cleanAgentName, isAgentAvatarUrl } from "./agent-name.policy"
import type { OptionalAvatarUrl } from "./agents.contracts"
import { AgentsError, AgentsErrorCode } from "./errors/agents.error"
import type { IdRow } from "./persistence/agents.rows"
import { RENAME_AGENT, SET_AGENT_AVATAR } from "./persistence/agents.sql"

const GOVERNORS = ["owner", "manager"] as const

@Injectable()
/** What the team sees of an agent, edited like a person's profile: its display name and its picture. The @handle never changes. */
export class AgentIdentityService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** Renames an agent; a manager only. The name is free text, trimmed and held to its length limits. */
    async rename(userId: string, workspaceId: string, agentId: string, name: string): Promise<void> {
        await this.members.require(userId, workspaceId, GOVERNORS)
        const clean = cleanAgentName(name)
        if (clean === null)
            throw new AgentsError({ code: AgentsErrorCode.NameInvalid, params: AGENT_DISPLAY_NAME_LIMITS })
        this.expectChanged(
            await this.entityManager.query<Array<IdRow>>(RENAME_AGENT, [agentId, workspaceId, clean]),
            agentId,
        )
    }

    /** Sets the picture of an agent (an HTTPS address) or clears it back to the generated avatar; a manager only. */
    async setAvatar(userId: string, workspaceId: string, agentId: string, avatarUrl: OptionalAvatarUrl): Promise<void> {
        await this.members.require(userId, workspaceId, GOVERNORS)
        if (avatarUrl !== null && !isAgentAvatarUrl(avatarUrl)) {
            throw new AgentsError({ code: AgentsErrorCode.AvatarInvalid })
        }
        this.expectChanged(
            await this.entityManager.query<Array<IdRow>>(SET_AGENT_AVATAR, [agentId, workspaceId, avatarUrl]),
            agentId,
        )
    }

    private expectChanged(rows: ReadonlyArray<IdRow>, agentId: string): void {
        if (rows.length === 0) throw new AgentsError({ code: AgentsErrorCode.AgentNotFound, params: { id: agentId } })
    }
}
