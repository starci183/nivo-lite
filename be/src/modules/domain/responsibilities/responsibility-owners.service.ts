import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { ResponsibilitiesError, ResponsibilitiesErrorCode } from "./errors/responsibilities.error"
import { isOwnerId, resolveOwner } from "./responsibility-owner.policy"
import type { OwnerAgent, OwnerCandidates, OwnerMember, ResolvedOwner } from "./responsibility-owner.policy"

const memberOwner = (row: OwnerMember): ResolvedOwner => ({
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
        const [seat] = await callDbFunction<{ workspace_owner_member: string | null }>(
            this.entityManager,
            "public.workspace_owner_member",
            [workspaceId],
        )
        const seatId = seat?.workspace_owner_member ?? null
        const row =
            seatId === null
                ? undefined
                : await this.entityManager
                      .createQueryBuilder()
                      .select("m.id", "id")
                      .addSelect("m.display_name", "display_name")
                      .from("public.workspace_members", "m")
                      .where("m.id = :seatId", { seatId })
                      .limit(1)
                      .getRawOne<OwnerMember>()
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
        const row = await this.entityManager
            .createQueryBuilder()
            .select("m.id", "id")
            .addSelect("m.display_name", "display_name")
            .from("public.workspace_members", "m")
            .where("m.workspace_id = :workspaceId AND m.status = 'active' AND lower(m.display_name) = lower(:name)", {
                workspaceId,
                name,
            })
            .orderBy("m.created_at", "ASC")
            .addOrderBy("m.id", "ASC")
            .limit(1)
            .getRawOne<OwnerMember>()
        return row === undefined ? null : memberOwner(row)
    }

    private async candidatesOf(manager: EntityManager, workspaceId: string, owner: string): Promise<OwnerCandidates> {
        const member = await manager
            .createQueryBuilder()
            .select("m.id", "id")
            .addSelect("m.display_name", "display_name")
            .from("public.workspace_members", "m")
            .where("m.workspace_id = :workspaceId AND m.id = :owner AND m.status = 'active'", { workspaceId, owner })
            .limit(1)
            .getRawOne<OwnerMember>()
        if (member !== undefined) return { member }
        const agent = await manager
            .createQueryBuilder()
            .select("a.id", "id")
            .addSelect("a.name", "name")
            .from("public.agents", "a")
            .where("a.workspace_id = :workspaceId AND a.id = :owner", { workspaceId, owner })
            .limit(1)
            .getRawOne<OwnerAgent>()
        return agent === undefined ? {} : { agent }
    }
}
