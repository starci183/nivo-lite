import { Injectable } from "@nestjs/common"
import type { EntityManager, UpdateResult } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { AGENT_DISPLAY_NAME_LIMITS, cleanAgentName, isAgentAvatarPreset, isAgentAvatarUrl } from "./agent-name.policy"
import type { OptionalAvatarPreset } from "./agent-name.contracts"
import type { OptionalAvatarUrl } from "./agents.contracts"
import { AgentsError, AgentsErrorCode } from "./errors/agents.error"
import { AgentEntity } from "./persistence/entities"

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
            await this.entityManager.update(AgentEntity, { id: agentId, workspaceId }, { name: clean }),
            agentId,
        )
    }

    /** Sets the picture of an agent (an HTTPS address, which drops any preset) or clears it back to the generated avatar; a manager only. */
    async setAvatar(userId: string, workspaceId: string, agentId: string, avatarUrl: OptionalAvatarUrl): Promise<void> {
        await this.members.require(userId, workspaceId, GOVERNORS)
        if (avatarUrl !== null && !isAgentAvatarUrl(avatarUrl)) {
            throw new AgentsError({ code: AgentsErrorCode.AvatarInvalid })
        }
        this.expectChanged(
            await this.entityManager.update(
                AgentEntity,
                { id: agentId, workspaceId },
                avatarUrl === null ? { avatarUrl } : { avatarUrl, avatarPreset: null },
            ),
            agentId,
        )
    }

    /**
     * Dresses an agent in a preset picture (the NIVO AI mark, its role's mark, its initials, a shop mark), dropping any uploaded picture;
     * null goes back to the default sprout Grammar draws from the name. A manager only.
     */
    async setAvatarPreset(
        userId: string,
        workspaceId: string,
        agentId: string,
        preset: OptionalAvatarPreset,
    ): Promise<void> {
        await this.members.require(userId, workspaceId, GOVERNORS)
        if (preset !== null && !isAgentAvatarPreset(preset)) {
            throw new AgentsError({ code: AgentsErrorCode.AvatarPresetInvalid, params: { preset } })
        }
        this.expectChanged(
            await this.entityManager.update(
                AgentEntity,
                { id: agentId, workspaceId },
                { avatarPreset: preset, avatarUrl: null },
            ),
            agentId,
        )
    }

    private expectChanged(result: UpdateResult, agentId: string): void {
        if ((result.affected ?? 0) === 0)
            throw new AgentsError({ code: AgentsErrorCode.AgentNotFound, params: { id: agentId } })
    }
}
