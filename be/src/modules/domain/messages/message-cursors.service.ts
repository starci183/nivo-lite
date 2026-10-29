import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OptionalCreatedAt, OptionalMessageCursor, OptionalRoom } from "./message-cursors.contracts"
import { MessageEntity } from "./persistence/entities"

/** The creation instant as the database words it, so no precision is lost. */
const CREATED_AT = "to_json(m.created_at) #>> '{}'"

@Injectable()
/** The positions chat receipts are measured at in the office rooms: an account's newest message and when a message was posted. */
export class MessageCursorsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The newest message the account authored in the room (any office room when `room` is null); null before any. */
    async newestAuthored(
        workspaceId: string,
        userId: string,
        room: OptionalRoom,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalMessageCursor> {
        const rows: ReadonlyArray<unknown> = await manager
            .createQueryBuilder(MessageEntity, "m")
            .select("m.id", "id")
            .addSelect(CREATED_AT, "createdAt")
            .where("m.workspace_id = :workspaceId AND m.author_user_id = :userId", { workspaceId, userId })
            .andWhere(room === null ? "true" : "m.room = :room", { room })
            .orderBy("m.created_at", "DESC")
            .addOrderBy("m.id", "DESC")
            .limit(1)
            .getRawMany()
        const [row] = rows
        if (typeof row !== "object" || row === null) return null
        const id: unknown = Reflect.get(row, "id")
        const createdAt: unknown = Reflect.get(row, "createdAt")
        return typeof id === "string" && typeof createdAt === "string" ? { id, createdAt } : null
    }

    /** The creation instant of a message posted in the room (any office room when `room` is null); null when there is no such message. */
    async createdAtOf(
        workspaceId: string,
        room: OptionalRoom,
        messageId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalCreatedAt> {
        const rows: ReadonlyArray<unknown> = await manager
            .createQueryBuilder(MessageEntity, "m")
            .select(CREATED_AT, "createdAt")
            .where("m.workspace_id = :workspaceId AND m.id = :messageId", { workspaceId, messageId })
            .andWhere(room === null ? "true" : "m.room = :room", { room })
            .limit(1)
            .getRawMany()
        const created = rows.map((row): unknown =>
            typeof row === "object" && row !== null ? Reflect.get(row, "createdAt") : null,
        )
        return created.find((value): value is string => typeof value === "string") ?? null
    }
}
