import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectAgentDirectory } from "@modules/domain/messages"
import type { AgentDirectory } from "@modules/domain/messages"
import { MemberLookupService } from "@modules/domain/workspace-members"
import type { NamedMember } from "@modules/domain/workspace-members"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { ResponsibilitiesError, ResponsibilitiesErrorCode } from "./errors/responsibilities.error"
import { isOwnerId, resolveOwner } from "./responsibility-owner.policy"
import type { OwnerCandidates, ResolvedOwner } from "./responsibility-owner.policy"

const memberOwner = (row: NamedMember): ResolvedOwner => ({
    kind: "human",
    agentId: null,
    memberId: row.id,
    name: row.displayName,
})

@Injectable()
/** Who owns a step: always one concrete member of the workspace or one agent of it, never the generic "human". */
export class ResponsibilityOwnersService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: MemberLookupService,
        @InjectAgentDirectory() private readonly agents: AgentDirectory,
    ) {}

    /**
     * The member or the agent a chosen owner id names, a concrete active member first,
     * else an agent of the workspace. An id that names neither, or a label such as "human", is refused.
     */
    async resolve(workspaceId: string, owner: string): Promise<ResolvedOwner> {
        const found = isOwnerId(owner) ? await this.candidatesOf(workspaceId, owner) : {}
        const verdict = resolveOwner(owner, found)
        if (verdict.kind === "refused") {
            throw new ResponsibilitiesError({ code: verdict.code, params: verdict.params })
        }
        return verdict.value
    }

    /** The workspace owner seat as an owner: the default of a step nobody else was named for. */
    async workspaceOwner(workspaceId: string): Promise<ResolvedOwner> {
        const [seat] = await callDbFunction<{ workspace_owner_member: string | null }>(
            this.entityManager,
            "public.workspace_owner_member",
            [workspaceId],
        )
        const seatId = seat?.workspace_owner_member ?? null
        const row = seatId === null ? null : await this.members.byId(seatId)
        if (row === null) {
            throw new ResponsibilitiesError({
                code: ResponsibilitiesErrorCode.OwnerNotFound,
                params: { id: workspaceId },
            })
        }
        return memberOwner(row)
    }

    /** The active member who carries a display name (ignoring case), or null when none does. */
    async memberNamed(workspaceId: string, name: string): Promise<ResolvedOwner | null> {
        const row = await this.members.activeNamed(workspaceId, name)
        return row === null ? null : memberOwner(row)
    }

    private async candidatesOf(workspaceId: string, owner: string): Promise<OwnerCandidates> {
        const member = await this.members.activeById(workspaceId, owner)
        if (member !== null) return { member: { id: member.id, display_name: member.displayName } }
        const agent = await this.agents.agentById(workspaceId, owner)
        return agent === null ? {} : { agent: { id: agent.id, name: agent.name } }
    }
}
