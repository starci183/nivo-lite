import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    ChatActivity,
    ChatMark,
    ChatNewest,
    ChatReader,
    MessageBrief,
    ChatThreadLine,
} from "./agent-messages-read.contracts"
import { AgentMessageEntity } from "./persistence/entities"

/** The caller's own lines are recognised by account id, and by display name only on legacy lines that carry no account id. */
const NOT_OWN_LINE =
    "m.author_user_id IS DISTINCT FROM :userId AND NOT (m.author_user_id IS NULL AND m.author_kind = 'human' AND m.author_name = :displayName)"

/** The instant each conversation was read up to: the unread filter looks its own conversation up in the given arrays. */
const MARKED_AT =
    "(SELECT t.read_at FROM unnest(CAST(:markIds AS text[]), CAST(:markReadAts AS timestamptz[])) AS t(conversation_id, read_at) WHERE t.conversation_id = m.conversation_id::text)"

/** The unread count of one conversation as the grouped read selects it. */
interface UnreadRaw {
    readonly conversation_id: string
    readonly unread: number
}

/** The newest line of one conversation as the read selects it. */
interface NewestRaw extends ChatNewest {
    readonly conversation_id: string
}

@Injectable()
/** Request-time reads of conversation lines for other capabilities: unread counts and newest lines. */
export class AgentMessagesReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The unread count since each conversation's mark and the newest line of each given conversation of the workspace. */
    async chatActivity(
        workspaceId: string,
        reader: ChatReader,
        marks: ReadonlyArray<ChatMark>,
    ): Promise<Array<ChatActivity>> {
        if (marks.length === 0) return []
        const conversationIds = marks.map((mark) => mark.conversationId)
        const scope = { workspaceId, conversationIds }
        const unread = await this.entityManager
            .createQueryBuilder(AgentMessageEntity, "m")
            .select("m.conversation_id::text", "conversation_id")
            .addSelect("LEAST(99, count(*))::int", "unread")
            .where("m.workspace_id = :workspaceId AND m.conversation_id IN (:...conversationIds)", scope)
            .andWhere(`m.created_at > COALESCE(${MARKED_AT}, '-infinity'::timestamptz)`, {
                markIds: conversationIds,
                markReadAts: marks.map((mark) => mark.readAt),
            })
            .andWhere(NOT_OWN_LINE, reader)
            .groupBy("m.conversation_id")
            .getRawMany<UnreadRaw>()
        const newest = await this.entityManager
            .createQueryBuilder(AgentMessageEntity, "m")
            .distinctOn(["m.conversation_id"])
            .select("m.conversation_id::text", "conversation_id")
            .addSelect("m.id::text", "id")
            .addSelect("m.body", "body")
            .addSelect("m.author_user_id::text", "author_user_id")
            .addSelect("m.author_name", "author_name")
            .addSelect("to_json(m.created_at) #>> '{}'", "at")
            .addSelect("to_char(m.created_at AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS')", "sort_at")
            .where("m.workspace_id = :workspaceId AND m.conversation_id IN (:...conversationIds)", scope)
            .orderBy("m.conversation_id")
            .addOrderBy("m.created_at", "DESC")
            .addOrderBy("m.id", "DESC")
            .getRawMany<NewestRaw>()
        const unreadOf = new Map(unread.map((row) => [row.conversation_id, row.unread]))
        const newestOf = new Map(newest.map((row) => [row.conversation_id, row]))
        return conversationIds.map((conversationId) => ({
            conversationId,
            unread: unreadOf.get(conversationId) ?? 0,
            newest: newestOf.get(conversationId),
        }))
    }

    /** The messages of the conversations written since `since`, oldest first, at most `limit`. */
    briefsIn(
        workspaceId: string,
        conversationIds: ReadonlyArray<string>,
        since: Date,
        limit: number,
    ): Promise<Array<MessageBrief>> {
        if (conversationIds.length === 0) return Promise.resolve([])
        return this.entityManager
            .createQueryBuilder(AgentMessageEntity, "m")
            .select("m.id", "id")
            .addSelect("m.conversation_id", "conversation_id")
            .addSelect("m.role", "role")
            .addSelect("m.body", "body")
            .addSelect("m.created_at", "created_at")
            .where("m.workspace_id = :workspaceId AND m.conversation_id IN (:...conversationIds)", {
                workspaceId,
                conversationIds: [...conversationIds],
            })
            .andWhere("m.created_at >= :since::timestamptz", { since })
            .orderBy("m.created_at")
            .addOrderBy("m.id")
            .limit(limit)
            .getRawMany<MessageBrief>()
    }

    /** The messages of one conversation with their authors and deliveries, oldest first, at most `limit`. */
    threadOf(workspaceId: string, conversationId: string, limit: number): Promise<Array<ChatThreadLine>> {
        return this.entityManager
            .createQueryBuilder(AgentMessageEntity, "m")
            .select("m.id", "id")
            .addSelect("m.conversation_id", "conversation_id")
            .addSelect("m.role", "role")
            .addSelect("m.author_kind", "author_kind")
            .addSelect("m.author_name", "author_name")
            .addSelect("m.body", "body")
            .addSelect("m.created_at", "created_at")
            .addSelect("m.delivery_status", "delivery_status")
            .addSelect("m.delivery_error", "delivery_error")
            .where("m.workspace_id = :workspaceId AND m.conversation_id = :conversationId", {
                workspaceId,
                conversationId,
            })
            .orderBy("m.created_at")
            .addOrderBy("m.id")
            .limit(limit)
            .getRawMany<ChatThreadLine>()
    }
}
