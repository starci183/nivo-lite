import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ResponsibilitiesError, ResponsibilitiesErrorCode } from "./errors/responsibilities.error"
import type { AgentsRow, MemberOwnerRow } from "./persistence/responsibilities.rows"
import {
    FIND_MEMBER_BY_NAME,
    FIND_OWNER_AGENT,
    FIND_OWNER_MEMBER,
    FIND_WORKSPACE_OWNER,
} from "./persistence/responsibility-owners.sql"
import { isOwnerId, resolveOwner } from "./responsibility-owner.policy"
import type { OwnerCandidates, ResolvedOwner } from "./responsibility-owner.policy"

const memberOwner = (row: MemberOwnerRow): ResolvedOwner => ({
    kind: "human",
    agentId: null,
    memberId: row.id,
    name: row.display_name,
})

@Injectable()
/** Who owns a step: always one concrete member of the workspace or one agent of it, never the generic "human". */
export class ResponsibilityOwnersService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /**
     * The member or the agent a chosen owner id names, looked up inside the caller's transaction: a concrete active member first,
     * else an agent of the workspace. An id that names neither, or a label such as "human", is refused.
     */
    async resolve(manager: EntityManager, workspaceId: string, owner: string): Promise<ResolvedOwner> {
        const found = isOwnerId(owner) ? await this.candidatesOf(manager, workspaceId, owner) : {}
        const verdict = resolveOwner(owner, found)
        if (verdict.kind === "refused") {
            throw new ResponsibilitiesError({ code: verdict.code, params: verdict.params })
        }
        return verdict.value
    }

    /** The workspace owner seat as an owner: the default of a step nobody else was named for. */
    async workspaceOwner(workspaceId: string): Promise<ResolvedOwner> {
        const [row] = await this.entityManager.query<Array<MemberOwnerRow>>(FIND_WORKSPACE_OWNER, [workspaceId])
        if (row === undefined) {
            throw new ResponsibilitiesError({
                code: ResponsibilitiesErrorCode.OwnerNotFound,
                params: { id: workspaceId },
            })
        }
        return memberOwner(row)
    }

    /** The active member who carries a display name (ignoring case), or null when none does. */
    async memberNamed(workspaceId: string, name: string): Promise<ResolvedOwner | null> {
        const [row] = await this.entityManager.query<Array<MemberOwnerRow>>(FIND_MEMBER_BY_NAME, [workspaceId, name])
        return row === undefined ? null : memberOwner(row)
    }

    private async candidatesOf(manager: EntityManager, workspaceId: string, owner: string): Promise<OwnerCandidates> {
        const [member] = await manager.query<Array<MemberOwnerRow>>(FIND_OWNER_MEMBER, [workspaceId, owner])
        if (member !== undefined) return { member }
        const [agent] = await manager.query<Array<AgentsRow>>(FIND_OWNER_AGENT, [workspaceId, owner])
        return agent === undefined ? {} : { agent }
    }
}
