import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentConversationsReadService } from "@modules/domain/agent-conversations"

/** A customer conversation of a workspace as the public API reads it. */
export interface PublicConversationRef {
    /** The conversation id. */
    readonly id: string
    /** The customer of the conversation, or null. */
    readonly lead_id: string | null
}

@Injectable()
/** The customer conversations the public API reads, through the manager of the caller's transaction. */
export class PublicConversationsService {
    constructor(private readonly chats: AgentConversationsReadService) {}

    /** A customer conversation of the workspace by id; another workspace's is not found. */
    async find(
        workspaceId: string,
        conversationId: string,
        manager: EntityManager,
    ): Promise<PublicConversationRef | undefined> {
        const chat = await this.chats.customerChat(workspaceId, conversationId, manager)
        return chat === null ? undefined : { id: chat.id, lead_id: chat.leadId }
    }

    /** The latest customer conversation of a customer. */
    async ofLead(workspaceId: string, leadId: string, manager: EntityManager): Promise<PublicConversationRef | undefined> {
        const chat = await this.chats.latestCustomerChatOfLead(workspaceId, leadId, manager)
        return chat === null ? undefined : { id: chat.id, lead_id: chat.leadId }
    }
}
