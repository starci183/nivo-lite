import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { OfficeRoomReadEntity } from "./persistence/entities"

/** A conflicting marker moves only to a later instant, which is what keeping the greater of the two means. */
const ONLY_FORWARD = "office_rooms_reads.last_read_at < EXCLUDED.last_read_at"

@Injectable()
/** Owns precise room read writes requested by the admitted chat receipt capability. */
export class OfficeReadMarkersService {
    /** Joins the receipt transaction and never moves an existing read marker backwards. */
    async advance(
        workspaceId: string,
        userId: string,
        room: string,
        createdAt: string,
        manager: EntityManager,
    ): Promise<void> {
        await manager
            .createQueryBuilder(OfficeRoomReadEntity, "office_rooms_reads")
            .insert()
            .values({ workspaceId, userId, room, lastReadAt: () => ":createdAt::timestamptz" })
            .orUpdate(["last_read_at"], ["workspace_id", "user_id", "room"], {
                overwriteCondition: { where: ONLY_FORWARD },
            })
            .setParameter("createdAt", createdAt)
            .execute()
    }
}
