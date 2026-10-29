import { Injectable } from "@nestjs/common"
import { In, MoreThanOrEqual, Not } from "typeorm"
import type { EntityManager, FindOptionsWhere } from "typeorm"
import { ChatActivityService, chatActivityTarget } from "@modules/domain/chat-activity"
import { AgentConversationEntity } from "@modules/domain/agent-conversations"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type {
    AgentThreadMessage,
    ApprovedMessageId,
    AuthorUserId,
    CustomerMessagesDay,
    StoredMessage,
    StoredReply,
    TranscriptLine,
} from "./agent-messages.contracts"
import type { ConversationMessage, ConversationMessagesQuery } from "./conversation-messages.contracts"
import { AgentMessagesError, AgentMessagesErrorCode } from "./errors/agent-messages.error"
import { AgentMessageEntity } from "./persistence/entities"

/** The most messages of a thread one read answers. */
const CHAT_MESSAGES_MAX = 300

/** The most lines of a transcript. */
const TRANSCRIPT_MAX = 40

/** True when a RETURNING row names the key of a stored message. */
const isStoredMessage = (value: unknown): value is { readonly id: string } =>
    typeof value === "object" && value !== null && "id" in value && typeof value.id === "string"

/** The ids a write answered. */
const returnedIds = (raw: unknown): ReadonlyArray<string> =>
    Array.isArray(raw) ? raw.filter(isStoredMessage).map((row) => row.id) : []

@Injectable()
/** The messages of a conversation between a customer and an agent; the only writer of agent_messages. */
export class AgentMessagesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly activity: ChatActivityService,
    ) {}

    /** The messages customers wrote per Vietnam day and channel from `from` (inclusive) to `to` (exclusive), oldest first. */
    async customerMessagesPerDay(
        workspaceId: string,
        from: string,
        to: string,
    ): Promise<ReadonlyArray<CustomerMessagesDay>> {
        // Only the customer side of real customer conversations is counted.
        const rows = await this.entityManager
            .createQueryBuilder(AgentMessageEntity, "m")
            .select("c.channel", "channel")
            .addSelect("to_char((m.createdAt AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM-DD')", "day")
            .addSelect("count(*)::integer", "messages")
            .innerJoin(AgentConversationEntity, "c", "c.id = m.conversation_id AND c.workspace_id = m.workspace_id")
            .where("m.workspaceId = :workspaceId AND m.role = 'user' AND c.kind = 'customer'", { workspaceId })
            .andWhere("c.channel IN ('facebook', 'zalo')")
            .andWhere("m.createdAt >= (:from::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')", { from })
            .andWhere("m.createdAt < (:to::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')", { to })
            .groupBy("c.channel")
            .addGroupBy("day")
            .orderBy("day", "ASC")
            .addOrderBy("c.channel", "ASC")
            .limit(400)
            .getRawMany<CustomerMessagesDay>()
        return rows.map((row) => ({ channel: row.channel, day: row.day, messages: row.messages }))
    }

    /** Reads messages of the selected conversations of the workspace after its caller membership was proved. */
    async listForConversations(
        workspaceId: string,
        conversationIds: ReadonlyArray<string>,
        query: ConversationMessagesQuery,
    ): Promise<Array<ConversationMessage>> {
        if (conversationIds.length === 0) return []
        const where: FindOptionsWhere<AgentMessageEntity> = {
            workspaceId,
            conversationId: In([...conversationIds]),
            ...(query.since === undefined ? {} : { createdAt: MoreThanOrEqual(new Date(query.since)) }),
        }
        const rows = await this.entityManager.find(AgentMessageEntity, {
            select: { conversationId: true, role: true, body: true, createdAt: true },
            where,
            order: { createdAt: query.oldestFirst === true ? "ASC" : "DESC", id: "ASC" },
            take: query.limit,
        })
        return rows.map((row) => ({
            conversation_id: row.conversationId,
            role: row.role,
            body: row.body,
            created_at: row.createdAt.toISOString(),
        }))
    }

    /** The bounded thread in a workspace the caller has proven. */
    async listChat(workspaceId: string, conversationId: string): Promise<ReadonlyArray<AgentThreadMessage>> {
        const rows = await this.entityManager.find(AgentMessageEntity, {
            select: { id: true, role: true, body: true, createdAt: true },
            where: { workspaceId, conversationId },
            order: { createdAt: "ASC", id: "ASC" },
            take: CHAT_MESSAGES_MAX,
        })
        return rows.map((row) => ({
            id: row.id,
            role: row.role === "user" || row.role === "system" ? row.role : "agent",
            body: row.body,
            createdAt: row.createdAt.toISOString(),
        }))
    }

    /** Stores a person customer reply in the transaction that queues its delivery. */
    storeHuman(
        workspaceId: string,
        conversationId: string,
        body: string,
        authorName: string,
        manager: EntityManager,
        authorUserId: AuthorUserId = null,
    ): Promise<string> {
        return this.storeHumanMessage(workspaceId, conversationId, body, authorName, manager, null, authorUserId)
    }

    /** Stores what the customer wrote and answers the message id. */
    async storeCustomer(
        workspaceId: string,
        conversationId: string,
        body: string,
        manager: EntityManager,
        authorUserId: AuthorUserId = null,
    ): Promise<string> {
        const id = this.required(
            await this.insert(manager, { workspaceId, conversationId, role: "user", body, authorUserId }),
        )
        await this.announce(workspaceId, conversationId, authorUserId, manager)
        return id
    }

    /** Stores the greeting the agent opens a visit with and answers the message id. */
    async storeGreeting(
        workspaceId: string,
        conversationId: string,
        body: string,
        manager: EntityManager,
    ): Promise<string> {
        const id = this.required(await this.insert(manager, { workspaceId, conversationId, role: "agent", body }))
        await this.announce(workspaceId, conversationId, null, manager)
        return id
    }

    /** Stores the reply of the agent to a customer message exactly once; a second attempt answers the reply the first one stored. */
    async storeReply(
        workspaceId: string,
        conversationId: string,
        body: string,
        inReplyTo: string,
    ): Promise<StoredReply> {
        const inserted = await this.entityManager
            .createQueryBuilder(AgentMessageEntity, "am")
            .insert()
            .values({ workspaceId, conversationId, role: "agent", body, inReplyTo })
            .orIgnore()
            .returning("id")
            .execute()
        const [id] = returnedIds(inserted.raw)
        if (id !== undefined) {
            await this.announce(workspaceId, conversationId, null, this.entityManager)
            return { id, body, sent: false }
        }
        const existing = await this.entityManager.findOne(AgentMessageEntity, {
            select: { id: true, body: true, deliveryStatus: true },
            where: { conversationId, inReplyTo, role: "agent" },
        })
        if (existing === null) throw new AgentMessagesError({ code: AgentMessagesErrorCode.NotStored })
        return { id: existing.id, body: existing.body, sent: existing.deliveryStatus === "sent" }
    }

    /** True when the agent already stored a reply to the customer message, which makes a new attempt a retry. */
    replyExists(conversationId: string, inReplyTo: string): Promise<boolean> {
        return this.entityManager.exists(AgentMessageEntity, { where: { conversationId, inReplyTo, role: "agent" } })
    }

    /** Stores a message the company sends on its own (not a reply to a customer message) and answers its id. */
    async storeAgentMessage(workspaceId: string, conversationId: string, body: string): Promise<string> {
        const id = this.required(
            await this.insert(this.entityManager, { workspaceId, conversationId, role: "agent", body }),
        )
        await this.announce(workspaceId, conversationId, null, this.entityManager)
        return id
    }

    /** Stores a member reply in the transaction of the caller; the stable id of an approval reuses the same message on retry. */
    async storeHumanMessage(
        workspaceId: string,
        conversationId: string,
        body: string,
        authorName: string,
        manager: EntityManager = this.entityManager,
        approvedItemId: ApprovedMessageId = null,
        authorUserId: AuthorUserId = null,
    ): Promise<string> {
        const ids = await this.insert(
            manager,
            {
                ...(approvedItemId === null ? {} : { id: approvedItemId }),
                workspaceId,
                conversationId,
                role: "agent",
                body,
                authorKind: "human",
                authorName,
                authorUserId,
            },
            true,
        )
        if (ids[0] === undefined && approvedItemId !== null) return approvedItemId
        const id = this.required(ids)
        await this.announce(workspaceId, conversationId, authorUserId, manager)
        return id
    }

    /** Writes a line the workbench shows between the messages; it is never sent to the customer. */
    async storeLine(
        workspaceId: string,
        conversationId: string,
        body: string,
        manager: EntityManager = this.entityManager,
    ): Promise<void> {
        await manager.insert(AgentMessageEntity, { workspaceId, conversationId, role: "system", body })
        await this.announce(workspaceId, conversationId, null, manager)
    }

    /** One stored message of a conversation, or a refusal when it is not there. */
    async find(messageId: string, conversationId: string): Promise<Outcome<StoredMessage, AgentMessagesErrorCode>> {
        const row = await this.entityManager.findOne(AgentMessageEntity, {
            select: { id: true, role: true, body: true, deliveryStatus: true },
            where: { id: messageId, conversationId },
        })
        if (row === null) return refused(AgentMessagesErrorCode.NotFound)
        return ok({ id: row.id, role: row.role ?? "", body: row.body, deliveryStatus: row.deliveryStatus })
    }

    /** The recent transcript of the conversation without system lines, oldest first. */
    async transcript(conversationId: string): Promise<ReadonlyArray<TranscriptLine>> {
        const recent = await this.entityManager.find(AgentMessageEntity, {
            select: { role: true, body: true, createdAt: true },
            where: { conversationId, role: Not("system") },
            order: { createdAt: "DESC", id: "DESC" },
            take: TRANSCRIPT_MAX,
        })
        const lines = recent.map((row): TranscriptLine => ({
            role: row.role === "user" ? "user" : "agent",
            body: row.body,
        }))
        lines.reverse()
        return lines
    }

    /** When the customer last wrote, or a refusal when they never did. */
    async lastCustomerAt(conversationId: string): Promise<Outcome<Date, AgentMessagesErrorCode>> {
        const row = await this.entityManager.findOne(AgentMessageEntity, {
            select: { createdAt: true },
            where: { conversationId, role: "user" },
            order: { createdAt: "DESC" },
        })
        return row === null ? refused(AgentMessagesErrorCode.NotFound) : ok(row.createdAt)
    }

    /** Writes the verdict of a delivery on the stored message so the workbench can show why a reply did not leave. */
    async markDelivery(messageId: string, delivered: boolean, error?: string): Promise<void> {
        await this.entityManager.update(
            AgentMessageEntity,
            { id: messageId },
            {
                deliveryStatus: delivered ? "sent" : "failed",
                deliveryError: delivered ? null : (error ?? "delivery_failed"),
            },
        )
    }

    /** Inserts one message and answers the ids it stored; with `orIgnore` a row that exists already stores nothing. */
    private async insert(
        manager: EntityManager,
        values: Partial<AgentMessageEntity>,
        orIgnore = false,
    ): Promise<ReadonlyArray<string>> {
        const insert = manager.createQueryBuilder(AgentMessageEntity, "am").insert().values(values)
        const written = await (orIgnore ? insert.orIgnore() : insert).returning("id").execute()
        return returnedIds(written.raw)
    }

    private announce(
        workspaceId: string,
        conversationId: string,
        authorUserId: AuthorUserId,
        manager: EntityManager,
    ): Promise<void> {
        return this.activity.message(
            workspaceId,
            chatActivityTarget({ room: null, conversationId }),
            authorUserId,
            manager,
        )
    }

    private required(ids: ReadonlyArray<string>): string {
        const [id] = ids
        if (id === undefined) throw new AgentMessagesError({ code: AgentMessagesErrorCode.NotStored })
        return id
    }
}
