import { Injectable } from "@nestjs/common"
import { In, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { AuthorityActionsService } from "@modules/domain/authority-actions"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { OfficeRoomDirectoryService } from "@modules/domain/office-rooms"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import type { MemberRow } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { MemberGrantsError, MemberGrantsErrorCode } from "./errors/member-grants.error"
import type { DirectoryMember, MemberGrantChange, MemberGrant } from "./member-grants.contracts"
import { MemberGrantEntity } from "./persistence/entities"
import type { MemberGrantUnit } from "./persistence/entities"

/** The most grants or members one list returns. */
const LIST_MAX = 500

/** The most seat rows the rooms of one directory read hold in all. */
const ROOM_SEAT_MAX = 5000

/** The unit a grant is counted in while the workspace has no rule for the action yet. */
const DEFAULT_UNIT: MemberGrantUnit = "vnd"

const toMember = (row: MemberRow, rooms: ReadonlyArray<string>): DirectoryMember => ({
    memberId: row.id,
    name: row.display_name,
    role: row.role,
    roomId: rooms[0] ?? null,
    status: row.status,
    rooms,
})

const isLimit = (value: number | null): boolean => value === null || (Number.isFinite(value) && value >= 0)

@Injectable()
/** What each member may approve: the only owner of the member_grants table. */
export class MemberGrantsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersReadService,
        private readonly rooms: OfficeRoomDirectoryService,
        private readonly actions: AuthorityActionsService,
        private readonly rules: AuthorityRulesService,
    ) {}

    /** Everyone of the workspace with the rooms they sit in, owners first. */
    async directory(workspaceId: string): Promise<ReadonlyArray<DirectoryMember>> {
        const people = await this.members.directory(workspaceId, LIST_MAX)
        const seats = await this.rooms.seatRoomsOf(
            workspaceId,
            people.map((person) => person.user_id),
            ROOM_SEAT_MAX,
        )
        return people.map((person) =>
            toMember(
                person,
                seats.filter((seat) => seat.userId === person.user_id).map((seat) => seat.key),
            ),
        )
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
     * guard rows are read under a share lock, then one upsert writes the grant.
     */
    private async saveGrant(
        tx: EntityManager,
        workspaceId: string,
        action: string,
        grant: MemberGrantChange,
    ): Promise<void> {
        const memberFound = await this.members.lockMember(tx, workspaceId, grant.memberId)
        if (!memberFound || !(await this.actions.exists(tx, action))) {
            throw new MemberGrantsError({ code: MemberGrantsErrorCode.UnknownTarget, params: { action } })
        }
        const setup = await this.rules.approvalSetup(workspaceId, action)
        await tx
            .createQueryBuilder(MemberGrantEntity, "mg")
            .insert()
            .values({
                workspaceId,
                memberId: grant.memberId,
                action,
                unit: setup?.unit ?? DEFAULT_UNIT,
                maxAmount: grant.maxAmount === null ? null : String(grant.maxAmount),
                updatedAt: () => "now()",
            })
            .orUpdate(["unit", "max_amount", "updated_at"], ["member_id", "action"])
            .execute()
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
