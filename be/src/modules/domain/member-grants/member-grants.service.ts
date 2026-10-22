import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { MemberGrantsError, MemberGrantsErrorCode } from "./errors/member-grants.error"
import type { DirectoryMember, MemberGrantChange, MemberGrant } from "./member-grants.contracts"
import type { DirectoryRow, GrantRow } from "./persistence/member-grants.rows"
import { DELETE_OTHER_GRANTS, LIST_ACTION_GRANTS, LIST_DIRECTORY, UPSERT_GRANT } from "./persistence/member-grants.sql"

const toMember = (row: DirectoryRow): DirectoryMember => ({
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
        const rows = await this.entityManager.query<Array<DirectoryRow>>(LIST_DIRECTORY, [workspaceId])
        return rows.map(toMember)
    }

    /** The grants of one action of the workspace. */
    forAction(workspaceId: string, action: string): Promise<ReadonlyArray<MemberGrant>> {
        return this.entityManager.query<Array<GrantRow>>(LIST_ACTION_GRANTS, [workspaceId, action])
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
                const [saved] = await tx.query<Array<GrantRow>>(UPSERT_GRANT, [
                    workspaceId,
                    grant.memberId,
                    action,
                    grant.maxAmount,
                ])
                if (saved === undefined) {
                    throw new MemberGrantsError({ code: MemberGrantsErrorCode.UnknownTarget, params: { action } })
                }
            })
            await tx.query(DELETE_OTHER_GRANTS, [workspaceId, action, grants.map((grant) => grant.memberId)])
            return tx.query<Array<GrantRow>>(LIST_ACTION_GRANTS, [workspaceId, action])
        })
    }
}
