import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type {
    AgentThreadMessage,
    ApprovedMessageId,
    CustomerMessagesDay,
    StoredMessage,
    StoredReply,
    TranscriptLine,
} from "./agent-messages.contracts"
import { AgentMessagesError, AgentMessagesErrorCode } from "./errors/agent-messages.error"
import type { ConversationMessageRow } from "./persistence/conversation-messages.rows"
import { LIST_CONVERSATION_MESSAGES } from "./persistence/conversation-messages.sql"
import type { ConversationMessagesQuery } from "./conversation-messages.contracts"
import type {
    ChatMessageRow,
    CustomerMessagesDayRow,
    LastMessageRow,
    MessageIdRow,
    StoredMessageRow,
    TranscriptRow,
} from "./persistence/agent-messages.rows"
import {
    COUNT_CUSTOMER_MESSAGES_PER_DAY,
    FIND_AGENT_REPLY,
    FIND_LAST_CUSTOMER_MESSAGE,
    FIND_MESSAGE,
    INSERT_AGENT_REPLY,
    INSERT_CUSTOMER_MESSAGE,
    INSERT_GREETING_MESSAGE,
    INSERT_HUMAN_MESSAGE,
    INSERT_SYSTEM_LINE,
    LIST_TRANSCRIPT,
    MARK_MESSAGE_DELIVERY,
    LIST_CHAT_MESSAGES,
} from "./persistence/agent-messages.sql"

@Injectable()
/** The messages of a conversation between a customer and an agent; the only writer of agent_messages. */
export class AgentMessagesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The messages customers wrote per Vietnam day and channel from `from` (inclusive) to `to` (exclusive), oldest first. */
    async customerMessagesPerDay(
        workspaceId: string,
        from: string,
        to: string,
    ): Promise<ReadonlyArray<CustomerMessagesDay>> {
        const rows = await this.entityManager.query<Array<CustomerMessagesDayRow>>(COUNT_CUSTOMER_MESSAGES_PER_DAY, [
            workspaceId,
            from,
            to,
        ])
        return rows.map((row) => ({ channel: row.channel, day: row.day, messages: row.messages }))
    }

    /** Reads messages of the workspace's selected conversations after its caller's membership was proved. */
    listForConversations(
        workspaceId: string,
        conversationIds: ReadonlyArray<string>,
        query: ConversationMessagesQuery,
    ): Promise<Array<ConversationMessageRow>> {
        if (conversationIds.length === 0) return Promise.resolve([])
        return this.entityManager.query<Array<ConversationMessageRow>>(LIST_CONVERSATION_MESSAGES, [
            workspaceId,
            conversationIds,
            query.since ?? null,
            query.oldestFirst ?? false,
            query.limit,
        ])
    }

    /** The bounded thread in a workspace the caller has proven. */
    async listChat(workspaceId: string, conversationId: string): Promise<ReadonlyArray<AgentThreadMessage>> {
        const rows = await this.entityManager.query<Array<ChatMessageRow>>(LIST_CHAT_MESSAGES, [
            workspaceId,
            conversationId,
        ])
        return rows.map((row) => ({
            id: row.id,
            role: row.role === "user" || row.role === "system" ? row.role : "agent",
            body: row.body,
            createdAt: new Date(row.created_at).toISOString(),
        }))
    }

    /** Stores a person's customer reply in the transaction that queues its delivery. */
    storeHuman(
        workspaceId: string,
        conversationId: string,
        body: string,
        authorName: string,
        manager: EntityManager,
    ): Promise<string> {
        return this.storeHumanMessage(workspaceId, conversationId, body, authorName, manager)
    }

    /** Stores what the customer wrote and answers the message id. */
    async storeCustomer(
        workspaceId: string,
        conversationId: string,
        body: string,
        manager: EntityManager,
    ): Promise<string> {
        return this.required(
            await manager.query<Array<MessageIdRow>>(INSERT_CUSTOMER_MESSAGE, [workspaceId, conversationId, body]),
        )
    }

    /** Stores the greeting the agent opens a visit with and answers the message id. */
    async storeGreeting(
        workspaceId: string,
        conversationId: string,
        body: string,
        manager: EntityManager,
    ): Promise<string> {
        return this.required(
            await manager.query<Array<MessageIdRow>>(INSERT_GREETING_MESSAGE, [workspaceId, conversationId, body]),
        )
    }

    /** Stores the agent's reply to a customer message exactly once; a second attempt answers the reply the first one stored. */
    async storeReply(
        workspaceId: string,
        conversationId: string,
        body: string,
        inReplyTo: string,
    ): Promise<StoredReply> {
        const inserted = (
            await this.entityManager.query<Array<MessageIdRow>>(INSERT_AGENT_REPLY, [
                workspaceId,
                conversationId,
                body,
                inReplyTo,
            ])
        )[0]
        if (inserted !== undefined) return { id: inserted.id, body, sent: false }
        const existing = (
            await this.entityManager.query<Array<StoredMessageRow>>(FIND_AGENT_REPLY, [conversationId, inReplyTo])
        )[0]
        if (existing === undefined) throw new AgentMessagesError({ code: AgentMessagesErrorCode.NotStored })
        return { id: existing.id, body: existing.body, sent: existing.delivery_status === "sent" }
    }

    /** True when the agent already stored a reply to the customer message, which makes a new attempt a retry. */
    async replyExists(conversationId: string, inReplyTo: string): Promise<boolean> {
        const rows = await this.entityManager.query<Array<StoredMessageRow>>(FIND_AGENT_REPLY, [
            conversationId,
            inReplyTo,
        ])
        return rows.length > 0
    }

    /** Stores a message the company sends on its own (not a reply to a customer message) and answers its id. */
    async storeAgentMessage(workspaceId: string, conversationId: string, body: string): Promise<string> {
        return this.required(
            await this.entityManager.query<Array<MessageIdRow>>(INSERT_GREETING_MESSAGE, [
                workspaceId,
                conversationId,
                body,
            ]),
        )
    }

    /** Stores a member's reply in the caller's transaction; an approval's stable id reuses the same message on retry. */
    async storeHumanMessage(
        workspaceId: string,
        conversationId: string,
        body: string,
        authorName: string,
        manager: EntityManager = this.entityManager,
        approvedItemId: ApprovedMessageId = null,
    ): Promise<string> {
        const rows = await manager.query<Array<MessageIdRow>>(INSERT_HUMAN_MESSAGE, [
            approvedItemId,
            workspaceId,
            conversationId,
            body,
            authorName,
        ])
        if (rows[0] === undefined && approvedItemId !== null) return approvedItemId
        return this.required(rows)
    }

    /** Writes a line the workbench shows between the messages; it is never sent to the customer. */
    async storeLine(
        workspaceId: string,
        conversationId: string,
        body: string,
        manager: EntityManager = this.entityManager,
    ): Promise<void> {
        await manager.query(INSERT_SYSTEM_LINE, [workspaceId, conversationId, body])
    }

    /** One stored message of a conversation, or a refusal when it is not there. */
    async find(messageId: string, conversationId: string): Promise<Outcome<StoredMessage, AgentMessagesErrorCode>> {
        const row = (
            await this.entityManager.query<Array<StoredMessageRow>>(FIND_MESSAGE, [messageId, conversationId])
        )[0]
        if (row === undefined) return refused(AgentMessagesErrorCode.NotFound)
        return ok({ id: row.id, role: row.role ?? "", body: row.body, deliveryStatus: row.delivery_status })
    }

    /** The recent transcript of the conversation without system lines, oldest first. */
    async transcript(conversationId: string): Promise<ReadonlyArray<TranscriptLine>> {
        const rows = await this.entityManager.query<Array<TranscriptRow>>(LIST_TRANSCRIPT, [conversationId])
        return rows.map((row): TranscriptLine => ({ role: row.role === "user" ? "user" : "agent", body: row.body }))
    }

    /** When the customer last wrote, or a refusal when they never did. */
    async lastCustomerAt(conversationId: string): Promise<Outcome<Date, AgentMessagesErrorCode>> {
        const row = (
            await this.entityManager.query<Array<LastMessageRow>>(FIND_LAST_CUSTOMER_MESSAGE, [conversationId])
        )[0]
        return row === undefined ? refused(AgentMessagesErrorCode.NotFound) : ok(new Date(row.created_at))
    }

    /** Writes the verdict of a delivery on the stored message so the workbench can show why a reply did not leave. */
    async markDelivery(messageId: string, delivered: boolean, error?: string): Promise<void> {
        await this.entityManager.query(MARK_MESSAGE_DELIVERY, [
            messageId,
            delivered ? "sent" : "failed",
            delivered ? null : (error ?? "delivery_failed"),
        ])
    }

    private required(rows: ReadonlyArray<MessageIdRow>): string {
        const row = rows[0]
        if (row === undefined) throw new AgentMessagesError({ code: AgentMessagesErrorCode.NotStored })
        return row.id
    }
}
