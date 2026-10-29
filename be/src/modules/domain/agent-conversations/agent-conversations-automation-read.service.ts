import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    AutomationChatLead,
    AutomationConversationRead,
} from "./agent-conversations-automation-read.contracts"
import { AgentConversationEntity } from "./persistence/entities"

/** The conversation columns an executor reads. */
const CONVERSATION_COLUMNS = [
    "c.id AS id",
    "c.channel AS channel",
    "c.handled_by AS handled_by",
    "c.visitor_name AS visitor_name",
    "c.lead_id AS lead_id",
]

/** The most leads one lookup of chats answers for. */
const CHAT_LEADS_LIMIT = 500

@Injectable()
/** The conversation reads the automations make: one conversation, the latest of a lead, and which leads have a real one. */
export class AgentConversationsAutomationReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** One conversation of a workspace, or none. */
    conversation(workspaceId: string, conversationId: string): Promise<AutomationConversationRead | undefined> {
        return this.entityManager
            .createQueryBuilder(AgentConversationEntity, "c")
            .select(CONVERSATION_COLUMNS)
            .where("c.workspace_id = :workspaceId AND c.id = :conversationId", { workspaceId, conversationId })
            .limit(1)
            .getRawOne<AutomationConversationRead>()
    }

    /** The latest real conversation of a lead (website chat, Telegram...): where a message to the customer leaves. */
    latestOfLead(workspaceId: string, leadId: string): Promise<AutomationConversationRead | undefined> {
        return this.entityManager
            .createQueryBuilder(AgentConversationEntity, "c")
            .select(CONVERSATION_COLUMNS)
            .where("c.workspace_id = :workspaceId AND c.lead_id = :leadId AND c.kind = 'customer'", {
                workspaceId,
                leadId,
            })
            .orderBy("c.created_at", "DESC")
            .limit(1)
            .getRawOne<AutomationConversationRead>()
    }

    /** The leads, among some, that have a real conversation; bounded. */
    leadsWithChat(workspaceId: string, leadIds: ReadonlyArray<string>): Promise<Array<AutomationChatLead>> {
        return this.entityManager
            .createQueryBuilder(AgentConversationEntity, "c")
            .select("DISTINCT c.lead_id", "lead_id")
            .where("c.workspace_id = :workspaceId AND c.kind = 'customer' AND c.lead_id = ANY(:leadIds::uuid[])", {
                workspaceId,
                leadIds,
            })
            .limit(CHAT_LEADS_LIMIT)
            .getRawMany<AutomationChatLead>()
    }
}
