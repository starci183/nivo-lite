import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"

/** A customer conversation of a workspace as the public API reads it. */
export interface ConversationRef {
    /** The conversation id. */
    readonly id: string
    /** The customer of the conversation, or null. */
    readonly lead_id: string | null
}

@Injectable()
/** The customer conversations the public API reads, through the manager of the caller's transaction. */
export class PublicConversationsService {
    /** A customer conversation of the workspace by id; another workspace's is not found. */
    find(workspaceId: string, conversationId: string, manager: EntityManager): Promise<ConversationRef | undefined> {
        return manager
            .createQueryBuilder()
            .select("c.id", "id")
            .addSelect("c.lead_id", "lead_id")
            .from("public.agent_conversations", "c")
            .where("c.workspace_id = :workspaceId AND c.kind = 'customer' AND c.id = :conversationId", {
                workspaceId,
                conversationId,
            })
            .limit(1)
            .getRawOne<ConversationRef>()
    }

    /** The latest customer conversation of a customer. */
    ofLead(workspaceId: string, leadId: string, manager: EntityManager): Promise<ConversationRef | undefined> {
        return manager
            .createQueryBuilder()
            .select("c.id", "id")
            .addSelect("c.lead_id", "lead_id")
            .from("public.agent_conversations", "c")
            .where("c.workspace_id = :workspaceId AND c.kind = 'customer' AND c.lead_id = :leadId", {
                workspaceId,
                leadId,
            })
            .orderBy("c.created_at", "DESC")
            .limit(1)
            .getRawOne<ConversationRef>()
    }
}
