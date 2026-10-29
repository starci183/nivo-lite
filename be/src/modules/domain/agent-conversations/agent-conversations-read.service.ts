import { Injectable } from "@nestjs/common"
import { In, IsNull, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OptionalChannelText, OptionalCustomerChatRef, TestChatRef } from "./agent-conversations-read.contracts"
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
}
