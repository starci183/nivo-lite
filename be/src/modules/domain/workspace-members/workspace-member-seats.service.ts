import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkspaceMemberEntity } from "./persistence/entities"
import type {
    ActiveUserRecord,
    MemberSeatRecord,
    OptionalMemberSeatRecord,
    UserSeatRecord,
} from "./workspace-member-seats.contracts"

/** The seat of a stored row, as the contract words it. */
const toSeat = (row: WorkspaceMemberEntity): MemberSeatRecord => ({
    memberId: row.id,
    userId: row.userId,
    role: row.role,
    displayName: row.displayName,
    status: row.status,
})

@Injectable()
/** The seat reads other capabilities ask of the members they join on: one seat, many seats, active accounts; always bounded. */
export class WorkspaceMemberSeatsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The active seat an account holds in the workspace; null when it holds none that is active. */
    async activeSeatOfUser(
        workspaceId: string,
        userId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalMemberSeatRecord> {
        const row = await manager.findOne(WorkspaceMemberEntity, { where: { workspaceId, userId, status: "active" } })
        return row === null ? null : toSeat(row)
    }

    /** The active seats an account holds across workspaces, newest seat first, at most `limit`. */
    async activeSeatsOfUser(userId: string, limit: number): Promise<Array<UserSeatRecord>> {
        const rows = await this.entityManager.find(WorkspaceMemberEntity, {
            select: { workspaceId: true, role: true },
            where: { userId, status: "active" },
            order: { createdAt: "DESC", id: "ASC" },
            take: limit,
        })
        return rows.map((row) => ({ workspaceId: row.workspaceId, role: row.role }))
    }

    /** The active accounts of the workspace with their seat names, in account id order, at most `limit`. */
    async activeUsers(
        workspaceId: string,
        limit: number,
        manager: EntityManager = this.entityManager,
    ): Promise<Array<ActiveUserRecord>> {
        const rows = await manager.find(WorkspaceMemberEntity, {
            select: { userId: true, displayName: true },
            where: { workspaceId, status: "active" },
            order: { userId: "ASC" },
            take: limit,
        })
        return rows.map((row) => ({ userId: row.userId, displayName: row.displayName }))
    }

    /** The seats of the workspace among the given seat ids, whatever their status; a missing seat is absent. */
    async seatsByIds(
        workspaceId: string,
        memberIds: ReadonlyArray<string>,
        limit: number,
    ): Promise<Array<MemberSeatRecord>> {
        if (memberIds.length === 0) return []
        const rows = await this.entityManager.find(WorkspaceMemberEntity, {
            where: { workspaceId, id: In([...memberIds]) },
            take: limit,
        })
        return rows.map(toSeat)
    }

    /** One seat of the workspace by seat id, whatever its status; null when there is none. */
    async seatById(workspaceId: string, memberId: string): Promise<OptionalMemberSeatRecord> {
        const row = await this.entityManager.findOne(WorkspaceMemberEntity, { where: { workspaceId, id: memberId } })
        return row === null ? null : toSeat(row)
    }

    /** How many of the given seat ids are active seats of the workspace. */
    countActiveAmong(workspaceId: string, memberIds: ReadonlyArray<string>): Promise<number> {
        if (memberIds.length === 0) return Promise.resolve(0)
        return this.entityManager.count(WorkspaceMemberEntity, {
            where: { workspaceId, id: In([...memberIds]), status: "active" },
        })
    }

    /** The given seat ids that are active seats of the workspace, at most `limit`. */
    async activeIdsAmong(workspaceId: string, memberIds: ReadonlyArray<string>, limit: number): Promise<Array<string>> {
        if (memberIds.length === 0) return []
        const rows = await this.entityManager.find(WorkspaceMemberEntity, {
            select: { id: true },
            where: { workspaceId, id: In([...memberIds]), status: "active" },
            take: limit,
        })
        return rows.map((row) => row.id)
    }
}
