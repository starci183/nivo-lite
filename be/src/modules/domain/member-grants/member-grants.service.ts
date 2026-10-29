import { Injectable } from "@nestjs/common"
import { In, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { MemberGrantsError, MemberGrantsErrorCode } from "./errors/member-grants.error"
import type { DirectoryMember, MemberGrantChange, MemberGrant } from "./member-grants.contracts"
import { MemberGrantEntity } from "./persistence/entities"
import type { MemberGrantUnit } from "./persistence/entities"

/** One member of the directory as the statement answers it. */
interface DirectoryRaw {
    readonly member_id: string
    readonly name: string
    readonly role: DirectoryMember["role"]
    readonly status: DirectoryMember["status"]
    readonly rooms: Array<string>
}

/** The rooms a member sits in, in room order. */
const MEMBER_ROOMS = `COALESCE((SELECT array_agg(r.key ORDER BY r.position, r.key)
    FROM public.office_rooms_members rm
    JOIN public.office_rooms r ON r.id = rm.room_id
    WHERE rm.user_id = m.user_id AND r.workspace_id = m.workspace_id), '{}'::text[])`

/** Owners first, then managers, then the rest. */
const ROLE_ORDER = "CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END"

/** The most grants or members one list returns. */
const LIST_MAX = 500

/** The unit of the workspace's rule for the action, VND while the rule does not exist yet. */
const RULE_UNIT = `COALESCE((SELECT r.unit FROM public.authority_rules r WHERE r.workspace_id = m.workspace_id AND r.action = a.action), 'vnd')`

/** What the guard read answers: the member that exists and the unit the grant is counted in. */
interface GuardRaw {
    readonly member_id: string
    readonly unit: MemberGrantUnit
}

/** The columns the upsert answers, in the shape of the contract. */
const GRANT_RETURNING =
    "id, workspace_id, member_id, action, unit, max_amount::float8 AS max_amount, to_json(updated_at) #>> '{}' AS updated_at"

const toMember = (row: DirectoryRaw): DirectoryMember => ({
    memberId: row.member_id,
    name: row.name,
    role: row.role,
    roomId: row.rooms[0] ?? null,
    status: row.status,
    rooms: row.rooms,
})

const isLimit = (value: number | null): boolean => value === null || (Number.isFinite(value) && value >= 0)

@Injectable()
/** What each member may approve: the only owner of the member_grants table. */
export class MemberGrantsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Everyone of the workspace with the rooms they sit in, owners first. */
    async directory(workspaceId: string): Promise<ReadonlyArray<DirectoryMember>> {
        const rows = await this.entityManager
            .createQueryBuilder()
            .select("m.id", "member_id")
            .addSelect("m.display_name", "name")
            .addSelect("m.role", "role")
            .addSelect("m.status", "status")
            .addSelect(MEMBER_ROOMS, "rooms")
            .from("public.workspace_members", "m")
            .where("m.workspace_id = :workspaceId", { workspaceId })
            .orderBy(ROLE_ORDER)
            .addOrderBy("m.created_at", "ASC")
            .addOrderBy("m.id", "ASC")
            .limit(LIST_MAX)
            .getRawMany<DirectoryRaw>()
        return rows.map(toMember)
    }

    /** The grants of one action of the workspace. */
    forAction(workspaceId: string, action: string): Promise<ReadonlyArray<MemberGrant>> {
        return this.grantsOf(this.entityManager, workspaceId, action)
    }

    /**
     * Makes the grants of one action exactly the ones named: each member named gets their limit, a member not named loses theirs.
     * Done in one transaction; a member outside the workspace or an action outside the registry refuses the whole change.
     */
    replaceForAction(
        workspaceId: string,
        action: string,
        grants: ReadonlyArray<MemberGrantChange>,
    ): Promise<ReadonlyArray<MemberGrant>> {
        if (!grants.every((grant) => isLimit(grant.maxAmount))) {
            return Promise.reject(new MemberGrantsError({ code: MemberGrantsErrorCode.InvalidLimit }))
        }
        return this.entityManager.transaction(async (tx) => {
            await eachInOrder(grants, async (grant) => {
                await this.saveGrant(tx, workspaceId, action, grant)
            })
            await tx.delete(MemberGrantEntity, {
                workspaceId,
                action,
                memberId: Not(In(grants.map((grant) => grant.memberId))),
            })
            return this.grantsOf(tx, workspaceId, action)
        })
    }

    /**
     * Creates or replaces the grant of one member for one action, counted in the unit of the workspace's rule for that action (VND
     * when the rule does not exist yet). Refuses when the member is not in the workspace or the action is not in the registry: the
     * guard rows are read under a share lock, then one insert with ON CONFLICT writes the grant.
     */
    private async saveGrant(
        tx: EntityManager,
        workspaceId: string,
        action: string,
        grant: MemberGrantChange,
    ): Promise<MemberGrant> {
        const guard = await tx
            .createQueryBuilder()
            .select("m.id", "member_id")
            .addSelect(RULE_UNIT, "unit")
            .from("public.workspace_members", "m")
            .innerJoin("authority_actions", "a", "a.action = :action", { action })
            .where("m.id = :memberId AND m.workspace_id = :workspaceId", { memberId: grant.memberId, workspaceId })
            .setLock("pessimistic_read")
            .getRawOne<GuardRaw>()
        if (guard === undefined) {
            throw new MemberGrantsError({ code: MemberGrantsErrorCode.UnknownTarget, params: { action } })
        }
        const saved = await tx
            .createQueryBuilder(MemberGrantEntity, "mg")
            .insert()
            .values({
                workspaceId,
                memberId: guard.member_id,
                action,
                unit: guard.unit,
                maxAmount: grant.maxAmount === null ? null : String(grant.maxAmount),
                updatedAt: () => "now()",
            })
            .orUpdate(["unit", "max_amount", "updated_at"], ["member_id", "action"])
            .returning(GRANT_RETURNING)
            .execute()
        return (saved.raw as Array<MemberGrant>)[0] as MemberGrant
    }

    /** The grants of one action; the limit as a number and the save time as ISO text, the shape the contract always had. */
    private grantsOf(manager: EntityManager, workspaceId: string, action: string): Promise<Array<MemberGrant>> {
        return manager
            .createQueryBuilder(MemberGrantEntity, "g")
            .select("g.id", "id")
            .addSelect("g.workspaceId", "workspace_id")
            .addSelect("g.memberId", "member_id")
            .addSelect("g.action", "action")
            .addSelect("g.unit", "unit")
            .addSelect("g.max_amount::float8", "max_amount")
            .addSelect("to_json(g.updated_at) #>> '{}'", "updated_at")
            .where("g.workspaceId = :workspaceId AND g.action = :action", { workspaceId, action })
            .orderBy("g.updatedAt", "ASC")
            .addOrderBy("g.id", "ASC")
            .limit(LIST_MAX)
            .getRawMany<MemberGrant>()
    }
}
