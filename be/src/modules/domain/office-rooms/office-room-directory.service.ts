import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { RoomLabel, UserSeatRoom } from "./office-room-directory.contracts"
import { OfficeRoomEntity, OfficeRoomMemberEntity } from "./persistence/entities"

@Injectable()
/** Request-time lookups of the department rooms for other capabilities: their names and who sits in them, always bounded. */
export class OfficeRoomDirectoryService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The names of the department rooms of a workspace by key, in room order. */
    labelsOf(workspaceId: string, keys: ReadonlyArray<string>, limit: number): Promise<Array<RoomLabel>> {
        if (keys.length === 0) return Promise.resolve([])
        return this.entityManager
            .createQueryBuilder(OfficeRoomEntity, "r")
            .select("r.key", "key")
            .addSelect("r.name", "name")
            .where("r.workspace_id = :workspaceId AND r.key IN (:...keys)", { workspaceId, keys })
            .orderBy("r.position", "ASC")
            .addOrderBy("r.key", "ASC")
            .limit(limit)
            .getRawMany<RoomLabel>()
    }

    /**
     * The department rooms of a workspace that have at least one person in them, in room order, bounded; `keys` narrows them to
     * those rooms (none given asks for every one).
     */
    staffedRooms(workspaceId: string, keys: ReadonlyArray<string> | null, limit: number): Promise<Array<RoomLabel>> {
        if (keys !== null && keys.length === 0) return Promise.resolve([])
        const rooms = this.entityManager
            .createQueryBuilder(OfficeRoomEntity, "r")
            .select("r.key", "key")
            .addSelect("r.name", "name")
            .where("r.workspace_id = :workspaceId", { workspaceId })
        const seated = rooms
            .subQuery()
            .select("1")
            .from(OfficeRoomMemberEntity, "rm")
            .where("rm.room_id = r.id AND rm.user_id IS NOT NULL")
        rooms.andWhereExists(seated)
        if (keys !== null) rooms.andWhere("r.key IN (:...keys)", { keys: [...keys] })
        return rooms.orderBy("r.position", "ASC").addOrderBy("r.key", "ASC").limit(limit).getRawMany<RoomLabel>()
    }

    /** The department rooms the given accounts sit in, in room order (a room of another workspace never counts). */
    seatRoomsOf(workspaceId: string, userIds: ReadonlyArray<string>, limit: number): Promise<Array<UserSeatRoom>> {
        if (userIds.length === 0) return Promise.resolve([])
        return this.entityManager
            .createQueryBuilder(OfficeRoomMemberEntity, "rm")
            .select("rm.userId", "userId")
            .addSelect("r.key", "key")
            .innerJoin(OfficeRoomEntity, "r", "r.id = rm.room_id AND r.workspace_id = :workspaceId", { workspaceId })
            .where("rm.userId IN (:...userIds)", { userIds })
            .orderBy("r.position", "ASC")
            .addOrderBy("r.key", "ASC")
            .limit(limit)
            .getRawMany<UserSeatRoom>()
    }
}
