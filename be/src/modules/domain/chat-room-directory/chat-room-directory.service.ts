import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { teamChatEntities } from "@modules/domain/team-chat"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ChatRoomDirectory, ChatRoomName, ChatSeatRoom } from "./chat-room-directory.contracts"

const [ChatRoomEntity, ChatRoomMemberEntity] = teamChatEntities

/** The kind of room a person is seated in: a group of the team, never a direct room. */
const GROUP = "group"

/** The kind of member that is a person. */
const USER = "user"

@Injectable()
/**
 * Request-time lookups of the team-chat groups for other capabilities: their names and the people who sit in them, always bounded. A room is
 * named by its id; a direct room between a person and an agent is never a group and is never listed here.
 */
export class ChatRoomDirectoryService implements ChatRoomDirectory {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The names of the groups of a workspace by room id, in room order. */
    async labelsOf(workspaceId: string, roomIds: ReadonlyArray<string>, limit: number): Promise<Array<ChatRoomName>> {
        if (roomIds.length === 0) return []
        const rooms = await this.entityManager
            .createQueryBuilder(ChatRoomEntity, "r")
            .where("r.workspace_id = :workspaceId AND r.kind = :kind AND r.id IN (:...roomIds)", {
                workspaceId,
                kind: GROUP,
                roomIds,
            })
            .orderBy("r.position", "ASC")
            .addOrderBy("r.id", "ASC")
            .limit(limit)
            .getMany()
        return rooms.map((room) => ({ key: room.id, name: room.name ?? "" }))
    }

    /** The groups the given accounts sit in, in room order (a room of another workspace never counts). */
    async seatRoomsOf(
        workspaceId: string,
        userIds: ReadonlyArray<string>,
        limit: number,
    ): Promise<Array<ChatSeatRoom>> {
        if (userIds.length === 0) return []
        const seats = await this.entityManager
            .createQueryBuilder(ChatRoomMemberEntity, "m")
            .innerJoin(ChatRoomEntity, "r", "r.id = m.room_id AND r.workspace_id = :workspaceId AND r.kind = :kind", {
                workspaceId,
                kind: GROUP,
            })
            .where("m.member_kind = :user AND m.member_id IN (:...userIds)", { user: USER, userIds })
            .orderBy("r.position", "ASC")
            .addOrderBy("r.id", "ASC")
            .limit(limit)
            .getMany()
        return seats.map((seat) => ({ userId: seat.memberId, key: seat.roomId }))
    }
}
