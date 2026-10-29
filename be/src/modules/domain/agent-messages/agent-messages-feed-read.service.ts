import { Injectable } from "@nestjs/common"
import { In, IsNull, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ConversationWrite, FeedMessage, OptionalDeliveredReply } from "./agent-messages-feed-read.contracts"
import { AgentMessageEntity } from "./persistence/entities"

/** The creation moment as Postgres words it in text. */
const CREATED_AT_TEXT = "m.created_at::text"

/** The most conversations one feed read looks across. */
const CONVERSATIONS_MAX = 500

@Injectable()
/** The message feeds a channel page shows beside its conversations: recent messages, the last delivered reply and who wrote lately. */
export class AgentMessagesFeedReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The newest customer and agent messages across the conversations, newest first, at most `limit`. */
    async recentIn(conversationIds: ReadonlyArray<string>, limit: number): Promise<Array<FeedMessage>> {
        if (conversationIds.length === 0) return []
        const rows = await this.entityManager
            .createQueryBuilder(AgentMessageEntity, "m")
            .select("m.id", "id")
            .addSelect("m.conversation_id", "conversationId")
            .addSelect("m.role", "role")
            .addSelect("m.body", "body")
            .addSelect(CREATED_AT_TEXT, "createdAt")
            .addSelect("m.delivery_status", "deliveryStatus")
            .addSelect("m.delivery_error", "deliveryError")
            .where("m.conversation_id IN (:...conversationIds) AND m.role IN ('user', 'agent')", {
                conversationIds: [...conversationIds],
            })
            .orderBy("m.created_at", "DESC")
            .limit(limit)
            .getRawMany<FeedMessage>()
        return rows
    }

    /** The newest agent reply across the conversations whose delivery was tried; null when none was. */
    async lastDeliveredReplyIn(conversationIds: ReadonlyArray<string>): Promise<OptionalDeliveredReply> {
        if (conversationIds.length === 0) return null
        const row = await this.entityManager.findOne(AgentMessageEntity, {
            select: { id: true, deliveryStatus: true, deliveryError: true },
            where: { conversationId: In([...conversationIds]), role: "agent", deliveryStatus: Not(IsNull()) },
            order: { createdAt: "DESC" },
        })
        return row === null || row.deliveryStatus === null
            ? null
            : { deliveryStatus: row.deliveryStatus, deliveryError: row.deliveryError }
    }

    /** When each conversation's customer last wrote, among the writes after `since`, newest first, at most `limit`. */
    async lastWritesSince(
        conversationIds: ReadonlyArray<string>,
        since: Date,
        limit: number,
    ): Promise<Array<ConversationWrite>> {
        if (conversationIds.length === 0) return []
        const rows = await this.entityManager
            .createQueryBuilder(AgentMessageEntity, "m")
            .select("m.conversation_id", "conversationId")
            .addSelect("max(m.created_at)::text", "lastAt")
            .where(
                "m.conversation_id IN (:...conversationIds) AND m.role = 'user' AND m.created_at > :since::timestamptz",
                {
                    conversationIds: [...conversationIds],
                    since: since.toISOString(),
                },
            )
            .groupBy("m.conversation_id")
            .orderBy("max(m.created_at)", "DESC")
            .limit(Math.min(limit, CONVERSATIONS_MAX))
            .getRawMany<ConversationWrite>()
        return rows
    }
}
