import { Injectable } from "@nestjs/common"
import { In, IsNull, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    ConnectionConversation,
    ConversationChannel,
    CustomerConversationRow,
    OptionalCustomerConversationRow,
    OptionalChannelText,
    OptionalCustomerChatRef,
    TestChatRef,
} from "./agent-conversations-read.contracts"
import { AgentConversationEntity } from "./persistence/entities"

@Injectable()
/** Request-time conversation lookups for other capabilities, always bounded by the caller. */
export class AgentConversationsReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The test chats (people trying an agent out) the given agents of the workspace have, in id order, bounded. */
    async testChatsOf(
        workspaceId: string,
        agentIds: ReadonlyArray<string>,
        limit: number,
    ): Promise<Array<TestChatRef>> {
        if (agentIds.length === 0) return []
        const chats = await this.entityManager.find(AgentConversationEntity, {
            select: { id: true, agentId: true },
            where: { workspaceId, kind: "test", agentId: In([...agentIds]) },
            order: { id: "ASC" },
            take: limit,
        })
        return chats.map((chat) => ({ id: chat.id, agentId: chat.agentId }))
    }

    /** Whether the workspace holds any customer conversation. */
    hasCustomerChat(workspaceId: string): Promise<boolean> {
        return this.entityManager.exists(AgentConversationEntity, { where: { workspaceId, kind: "customer" } })
    }

    /** Whether any conversation of the workspace has a customer captured. */
    hasLeadChat(workspaceId: string): Promise<boolean> {
        return this.entityManager.exists(AgentConversationEntity, { where: { workspaceId, leadId: Not(IsNull()) } })
    }

    /** A customer conversation of the workspace by id; another workspace's is not found. */
    async customerChat(
        workspaceId: string,
        conversationId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalCustomerChatRef> {
        const chat = await manager.findOne(AgentConversationEntity, {
            select: { id: true, leadId: true },
            where: { workspaceId, kind: "customer", id: conversationId },
        })
        return chat === null ? null : { id: chat.id, leadId: chat.leadId }
    }

    /** The latest customer conversation of a customer; null when there is none. */
    async latestCustomerChatOfLead(
        workspaceId: string,
        leadId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalCustomerChatRef> {
        const chat = await manager.findOne(AgentConversationEntity, {
            select: { id: true, leadId: true },
            where: { workspaceId, kind: "customer", leadId },
            order: { createdAt: "DESC" },
        })
        return chat === null ? null : { id: chat.id, leadId: chat.leadId }
    }

    /** The channel of a conversation by id; null when there is no such conversation. */
    async channelOf(conversationId: string): Promise<OptionalChannelText> {
        const row = await this.entityManager.findOne(AgentConversationEntity, {
            select: { id: true, channel: true },
            where: { id: conversationId },
        })
        return row?.channel ?? null
    }

    /** The conversations of a connection on a channel, oldest first, at most `limit`. */
    async onConnection(
        workspaceId: string,
        connectionId: string,
        channel: string,
        limit: number,
    ): Promise<Array<ConnectionConversation>> {
        const rows = await this.entityManager.find(AgentConversationEntity, {
            select: { id: true, externalId: true, visitorName: true },
            where: { workspaceId, connectionId, channel },
            order: { createdAt: "ASC", id: "ASC" },
            take: limit,
        })
        return rows.map((row) => ({ id: row.id, externalId: row.externalId, visitorName: row.visitorName }))
    }

    /** The channel of each customer conversation among these ids that runs on one of the channels. */
    async customerChannelsAmong(
        workspaceId: string,
        conversationIds: ReadonlyArray<string>,
        channels: ReadonlyArray<string>,
    ): Promise<Array<ConversationChannel>> {
        if (conversationIds.length === 0) return []
        const rows = await this.entityManager.find(AgentConversationEntity, {
            select: { id: true, channel: true },
            where: { workspaceId, kind: "customer", id: In([...conversationIds]), channel: In([...channels]) },
            take: conversationIds.length,
        })
        return rows.map((row) => ({ id: row.id, channel: row.channel }))
    }

    /** The newest customer conversations of the given agents, newest first, at most `limit`. */
    customerOfAgents(
        workspaceId: string,
        agentIds: ReadonlyArray<string>,
        limit: number,
    ): Promise<Array<CustomerConversationRow>> {
        if (agentIds.length === 0) return Promise.resolve([])
        return this.customerColumns()
            .where("c.workspace_id = :workspaceId AND c.kind = 'customer'", { workspaceId })
            .andWhere("c.agent_id IN (:...agentIds)", { agentIds: [...agentIds] })
            .orderBy("c.created_at", "DESC")
            .limit(limit)
            .getRawMany<CustomerConversationRow>()
    }

    /** The customer conversation of the workspace under the id; null when there is none. */
    async customerById(workspaceId: string, conversationId: string): Promise<OptionalCustomerConversationRow> {
        const [row] = await this.customerColumns()
            .where("c.workspace_id = :workspaceId AND c.id = :conversationId AND c.kind = 'customer'", {
                workspaceId,
                conversationId,
            })
            .limit(1)
            .getRawMany<CustomerConversationRow>()
        return row ?? null
    }

    /** A read of the inbox columns of conversations, each under its stored column name. */
    private customerColumns() {
        return this.entityManager
            .createQueryBuilder(AgentConversationEntity, "c")
            .select("c.id", "id")
            .addSelect("c.channel", "channel")
            .addSelect("c.visitor_name", "visitor_name")
            .addSelect("c.lead_id", "lead_id")
            .addSelect("c.handled_by", "handled_by")
            .addSelect("c.handled_at", "handled_at")
            .addSelect("c.external_id", "external_id")
            .addSelect("c.created_at", "created_at")
    }
}
