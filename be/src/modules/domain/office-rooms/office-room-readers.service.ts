import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OptionalRoomKey, RoomReaderStanding } from "./office-room-readers.contracts"
import { OfficeRoomReadEntity } from "./persistence/entities"

@Injectable()
/** Who has read a room up to a message instant, as the room read markers answer it. */
export class OfficeRoomReadersService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /**
     * The given accounts whose marker for the room ('' being the Office room) is at or past the instant, each marked strictly later or
     * exactly on it; the instant is compared at the database's own precision.
     */
    async readersAt(
        workspaceId: string,
        room: OptionalRoomKey,
        userIds: ReadonlyArray<string>,
        createdAt: string,
        manager: EntityManager = this.entityManager,
    ): Promise<Array<RoomReaderStanding>> {
        if (userIds.length === 0) return []
        const rows = await manager
            .createQueryBuilder(OfficeRoomReadEntity, "rd")
            .select("rd.user_id", "userId")
            .addSelect("CASE WHEN rd.last_read_at > :createdAt::timestamptz THEN 'later' ELSE 'equal' END", "standing")
            .where("rd.workspace_id = :workspaceId AND rd.user_id IN (:...userIds)", {
                workspaceId,
                userIds: [...userIds],
            })
            .andWhere("rd.room = COALESCE(:room::text, '')", { room })
            .andWhere("rd.last_read_at >= :createdAt::timestamptz", { createdAt })
            .limit(userIds.length)
            .getRawMany<RoomReaderStanding>()
        return rows
    }
}
