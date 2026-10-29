import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkspaceMemberEntity } from "./persistence/entities"
import type { MemberName, MemberRow, MemberSeat } from "./workspace-members-read.contracts"

/** The sortable text of a creation instant: digits only, fixed width, microsecond exact, so text order is time order. */
const SEAT_AT = "to_char(m.created_at AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS')"

/** Owners first, then managers, then staff: the order the directory lists. */
const ROLE_RANK = "CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END"

@Injectable()
/** Request-time member lookups for other capabilities: counts, previews and names, always bounded by the caller. */
export class WorkspaceMembersReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** How many active members the workspace has. */
    activeCount(workspaceId: string): Promise<number> {
        return this.entityManager.count(WorkspaceMemberEntity, { where: { workspaceId, status: "active" } })
    }

    /** The oldest active members as seats, oldest first (ties by member id). */
    firstActive(workspaceId: string, limit: number): Promise<Array<MemberSeat>> {
        return this.seatsQuery(workspaceId)
            .andWhere("m.status = 'active'")
            .orderBy("m.createdAt")
            .addOrderBy("m.id")
            .limit(limit)
            .getRawMany<MemberSeat>()
    }

    /** The active members among the given accounts as seats, in no particular order. */
    activeByUserIds(workspaceId: string, userIds: ReadonlyArray<string>): Promise<Array<MemberSeat>> {
        if (userIds.length === 0) return Promise.resolve([])
        return this.seatsQuery(workspaceId)
            .andWhere("m.status = 'active' AND m.userId IN (:...userIds)", { userIds: [...new Set(userIds)] })
            .getRawMany<MemberSeat>()
    }

    /** How many active owners and managers the workspace has. */
    stewardCount(workspaceId: string): Promise<number> {
        return this.entityManager.count(WorkspaceMemberEntity, {
            where: { workspaceId, status: "active", role: In(["owner", "manager"]) },
        })
    }

    /** The oldest active owners and managers as seats, oldest first (ties by member id). */
    firstStewards(workspaceId: string, limit: number): Promise<Array<MemberSeat>> {
        return this.seatsQuery(workspaceId)
            .andWhere("m.status = 'active' AND m.role IN ('owner', 'manager')")
            .orderBy("m.createdAt")
            .addOrderBy("m.id")
            .limit(limit)
            .getRawMany<MemberSeat>()
    }

    /** The display names of the given accounts of the workspace, whatever their status. */
    async namesOf(workspaceId: string, userIds: ReadonlyArray<string>): Promise<Array<MemberName>> {
        if (userIds.length === 0) return []
        const accounts = [...new Set(userIds)]
        const members = await this.entityManager.find(WorkspaceMemberEntity, {
            select: { userId: true, displayName: true },
            where: { workspaceId, userId: In(accounts) },
            take: accounts.length,
        })
        return members.map((member) => ({ userId: member.userId, displayName: member.displayName }))
    }

    /** Everyone of the workspace, owners first, then managers, then the rest, oldest first, bounded. */
    directory(workspaceId: string, limit: number): Promise<Array<MemberRow>> {
        return this.entityManager
            .createQueryBuilder(WorkspaceMemberEntity, "m")
            .select("m.id", "id")
            .addSelect("m.userId", "user_id")
            .addSelect("m.displayName", "display_name")
            .addSelect("m.role", "role")
            .addSelect("m.status", "status")
            .where("m.workspaceId = :workspaceId", { workspaceId })
            .orderBy(ROLE_RANK)
            .addOrderBy("m.createdAt", "ASC")
            .addOrderBy("m.id", "ASC")
            .limit(limit)
            .getRawMany<MemberRow>()
    }

    /** Proves a member row of the workspace under a share lock inside the caller's transaction; false when there is none. */
    async lockMember(manager: EntityManager, workspaceId: string, memberId: string): Promise<boolean> {
        const member = await manager.findOne(WorkspaceMemberEntity, {
            select: { id: true },
            where: { id: memberId, workspaceId },
            lock: { mode: "pessimistic_read" },
        })
        return member !== null
    }

    private seatsQuery(workspaceId: string): SelectQueryBuilder<WorkspaceMemberEntity> {
        return this.entityManager
            .createQueryBuilder(WorkspaceMemberEntity, "m")
            .select("m.id", "seat_id")
            .addSelect("m.userId", "id")
            .addSelect("m.displayName", "name")
            .addSelect(SEAT_AT, "at")
            .where("m.workspaceId = :workspaceId", { workspaceId })
    }
}
