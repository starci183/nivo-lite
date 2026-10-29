import { Injectable } from "@nestjs/common"
import { Raw } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OptionalNamedMember, OwnerMemberRef } from "./member-lookup.contracts"
import { WorkspaceMemberEntity } from "./persistence/entities"

const REF_COLUMNS = { id: true, displayName: true } as const

@Injectable()
/** Request-time member lookups for other capabilities: who a seat or a name is, always bounded by the caller. */
export class MemberLookupService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The active owners and managers of a workspace. */
    async ownersAndManagers(workspaceId: string, limit: number): Promise<Array<OwnerMemberRef>> {
        const rows = await this.entityManager
            .createQueryBuilder(WorkspaceMemberEntity, "m")
            .where("m.workspaceId = :workspaceId AND m.status = 'active' AND m.role IN ('owner', 'manager')", {
                workspaceId,
            })
            .limit(limit)
            .getMany()
        return rows.map((row) => ({ userId: row.userId, displayName: row.displayName }))
    }

    /** The active member of the workspace with this membership id; null when there is none. */
    async activeById(workspaceId: string, memberId: string): Promise<OptionalNamedMember> {
        const row = await this.entityManager.findOne(WorkspaceMemberEntity, {
            select: REF_COLUMNS,
            where: { workspaceId, id: memberId, status: "active" },
        })
        return row === null ? null : { id: row.id, displayName: row.displayName }
    }

    /** The member with this membership id, active or not; null when there is none. */
    async byId(memberId: string): Promise<OptionalNamedMember> {
        const row = await this.entityManager.findOne(WorkspaceMemberEntity, {
            select: REF_COLUMNS,
            where: { id: memberId },
        })
        return row === null ? null : { id: row.id, displayName: row.displayName }
    }

    /** The oldest active member who carries a display name (ignoring case); null when none does. */
    async activeNamed(workspaceId: string, name: string): Promise<OptionalNamedMember> {
        const row = await this.entityManager.findOne(WorkspaceMemberEntity, {
            select: REF_COLUMNS,
            where: {
                workspaceId,
                status: "active",
                displayName: Raw((column) => `lower(${column}) = lower(:name)`, { name }),
            },
            order: { createdAt: "ASC", id: "ASC" },
        })
        return row === null ? null : { id: row.id, displayName: row.displayName }
    }
}
