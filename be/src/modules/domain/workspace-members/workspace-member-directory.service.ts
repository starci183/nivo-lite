import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkspaceMemberEntity } from "./persistence/entities"
import type {
    MemberDirectoryEntry,
    OptionalAccountId,
    OptionalMemberDirectoryEntry,
} from "./workspace-member-directory.contracts"
import type { WorkspaceMember } from "./workspace-members.contracts"

const DIRECTORY_COLUMNS = { id: true, displayName: true, role: true } as const

/** Owners first, then managers, then staff: the order the directory lists. */
const ROLE_RANK = "CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END"

const toDirectoryMember = (row: WorkspaceMemberEntity): MemberDirectoryEntry => ({
    id: row.id,
    displayName: row.displayName,
    role: row.role,
})

@Injectable()
/**
 * Request-time member lookups for other capabilities: seats of a person, directories and proofs of a seat, always bounded by the
 * caller. Each lookup that a caller may run inside its own transaction takes that transaction's manager last.
 */
export class WorkspaceMemberDirectoryService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Every seat the person holds, in any workspace and status, oldest first. */
    async seatsOf(userId: string, limit: number): Promise<Array<WorkspaceMember>> {
        const rows = await this.entityManager.find(WorkspaceMemberEntity, {
            where: { userId },
            order: { createdAt: "ASC", id: "ASC" },
            take: limit,
        })
        return rows.map((row) => ({
            userId: row.userId,
            workspaceId: row.workspaceId,
            role: row.role,
            staffId: row.staffId,
            displayName: row.displayName,
            status: row.status,
        }))
    }

    /** Whether the person holds any seat, active or not. */
    holdsAny(userId: string, manager: EntityManager = this.entityManager): Promise<boolean> {
        return manager.exists(WorkspaceMemberEntity, { where: { userId } })
    }

    /** Whether the person holds an active owner seat in the workspace. */
    isActiveOwner(workspaceId: string, userId: string, manager: EntityManager = this.entityManager): Promise<boolean> {
        return manager.exists(WorkspaceMemberEntity, {
            where: { workspaceId, userId, role: "owner", status: "active" },
        })
    }

    /** The account of the oldest active owner of the workspace; null when it has none. */
    async firstActiveOwnerUserId(workspaceId: string): Promise<OptionalAccountId> {
        const row = await this.entityManager.findOne(WorkspaceMemberEntity, {
            select: { userId: true },
            where: { workspaceId, role: "owner", status: "active" },
            order: { createdAt: "ASC" },
        })
        return row?.userId ?? null
    }

    /** The accounts that hold a seat in any of the workspaces, each once, in id order, bounded. */
    async userIdsOf(workspaceIds: ReadonlyArray<string>, limit: number): Promise<Array<string>> {
        if (workspaceIds.length === 0) return []
        const rows = await this.entityManager
            .createQueryBuilder(WorkspaceMemberEntity, "m")
            .select("m.userId", "user_id")
            .where("m.workspaceId IN (:...workspaceIds)", { workspaceIds: [...workspaceIds] })
            .groupBy("m.userId")
            .orderBy("m.userId")
            .limit(limit)
            .getRawMany<{ readonly user_id: string }>()
        return rows.map((row) => row.user_id)
    }

    /** The active members of the workspace, owners first, then managers, then staff, by name, bounded. */
    async activeDirectory(workspaceId: string, limit: number): Promise<Array<MemberDirectoryEntry>> {
        const rows = await this.entityManager
            .createQueryBuilder(WorkspaceMemberEntity, "m")
            .where("m.workspaceId = :workspaceId AND m.status = 'active'", { workspaceId })
            .orderBy(ROLE_RANK, "ASC")
            .addOrderBy("m.displayName", "ASC")
            .limit(limit)
            .getMany()
        return rows.map(toDirectoryMember)
    }

    /** The active members of the workspace among the given membership ids, owners first, then managers, then staff, bounded. */
    async activeAmong(
        workspaceId: string,
        memberIds: ReadonlyArray<string>,
        limit: number,
        manager: EntityManager = this.entityManager,
    ): Promise<Array<MemberDirectoryEntry>> {
        if (memberIds.length === 0) return []
        const rows = await manager
            .createQueryBuilder(WorkspaceMemberEntity, "m")
            .where("m.workspaceId = :workspaceId AND m.status = 'active' AND m.id IN (:...memberIds)", {
                workspaceId,
                memberIds: [...memberIds],
            })
            .orderBy(ROLE_RANK, "ASC")
            .addOrderBy("m.displayName", "ASC")
            .limit(limit)
            .getMany()
        return rows.map(toDirectoryMember)
    }

    /** The members of the workspace among the given membership ids, whatever their status; one that does not exist is missing. */
    async byIds(
        workspaceId: string,
        memberIds: ReadonlyArray<string>,
        manager: EntityManager = this.entityManager,
    ): Promise<Array<MemberDirectoryEntry>> {
        if (memberIds.length === 0) return []
        const rows = await manager.find(WorkspaceMemberEntity, {
            select: DIRECTORY_COLUMNS,
            where: { workspaceId, id: In([...memberIds]) },
            take: memberIds.length,
        })
        return rows.map(toDirectoryMember)
    }

    /** The membership id of an account in the workspace, whatever its status; null when the account holds no seat. */
    async idOfUser(
        workspaceId: string,
        userId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalAccountId> {
        const row = await manager.findOne(WorkspaceMemberEntity, {
            select: { id: true },
            where: { workspaceId, userId },
        })
        return row?.id ?? null
    }

    /** One member of the workspace by membership id, whatever its status; null when there is none. */
    async find(
        workspaceId: string,
        memberId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalMemberDirectoryEntry> {
        const row = await manager.findOne(WorkspaceMemberEntity, {
            select: DIRECTORY_COLUMNS,
            where: { workspaceId, id: memberId },
        })
        return row === null ? null : toDirectoryMember(row)
    }
}
