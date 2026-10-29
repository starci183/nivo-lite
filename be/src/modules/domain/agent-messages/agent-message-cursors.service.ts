import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OptionalAgentMessageCursor, OptionalCreatedAt } from "./agent-message-cursors.contracts"
import { AgentMessageEntity } from "./persistence/entities"

/** The creation instant as the database words it, so no precision is lost. */
const CREATED_AT = "to_json(m.created_at) #>> '{}'"

@Injectable()
/** The positions chat receipts are measured at in a conversation: an account's newest message and when a message was posted. */
export class AgentMessageCursorsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The newest message the account authored in the conversation; null before any. */
    async newestAuthored(
        workspaceId: string,
        userId: string,
        conversationId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalAgentMessageCursor> {
        const rows: ReadonlyArray<unknown> = await manager
            .createQueryBuilder(AgentMessageEntity, "m")
            .select("m.id", "id")
            .addSelect(CREATED_AT, "createdAt")
            .where(
                "m.workspace_id = :workspaceId AND m.conversation_id = :conversationId AND m.author_user_id = :userId",
                { workspaceId, conversationId, userId },
            )
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

    /** The creation instant of a message posted in the conversation; null when there is no such message. */
    async createdAtOf(
        workspaceId: string,
        conversationId: string,
        messageId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalCreatedAt> {
        const rows: ReadonlyArray<unknown> = await manager
            .createQueryBuilder(AgentMessageEntity, "m")
            .select(CREATED_AT, "createdAt")
            .where("m.workspace_id = :workspaceId AND m.conversation_id = :conversationId AND m.id = :messageId", {
                workspaceId,
                conversationId,
                messageId,
            })
            .limit(1)
            .getRawMany()
        const created = rows.map((row): unknown =>
            typeof row === "object" && row !== null ? Reflect.get(row, "createdAt") : null,
        )
        return created.find((value): value is string => typeof value === "string") ?? null
    }
}
