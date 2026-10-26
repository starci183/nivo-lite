import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ADVANCE_ROOM_READ_CURSOR } from "./persistence/office-read-markers.sql"

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
        await manager.query(ADVANCE_ROOM_READ_CURSOR, [workspaceId, userId, room, createdAt])
    }
}
