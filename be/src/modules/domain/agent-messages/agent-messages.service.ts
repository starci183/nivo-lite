import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { StoredMessage, StoredReply, TranscriptLine } from "./agent-messages.contracts"
import { AgentMessagesError, AgentMessagesErrorCode } from "./errors/agent-messages.error"
import type { ConversationMessageRow } from "./persistence/conversation-messages.rows"
import { LIST_CONVERSATION_MESSAGES } from "./persistence/conversation-messages.sql"
import type { ConversationMessagesQuery } from "./conversation-messages.contracts"
import type { LastMessageRow, MessageIdRow, StoredMessageRow, TranscriptRow } from "./persistence/agent-messages.rows"
import {
    FIND_AGENT_REPLY,
    FIND_LAST_CUSTOMER_MESSAGE,
    FIND_MESSAGE,
    INSERT_AGENT_REPLY,
    INSERT_CUSTOMER_MESSAGE,
    INSERT_GREETING_MESSAGE,
    INSERT_SYSTEM_LINE,
    LIST_TRANSCRIPT,
    MARK_MESSAGE_DELIVERY,
} from "./persistence/agent-messages.sql"

@Injectable()
/** The messages of a conversation between a customer and an agent; the only writer of agent_messages. */
export class AgentMessagesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

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

    /** Writes a line the workbench shows between the messages; it is never sent to the customer. */
    async storeLine(workspaceId: string, conversationId: string, body: string): Promise<void> {
        await this.entityManager.query(INSERT_SYSTEM_LINE, [workspaceId, conversationId, body])
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
