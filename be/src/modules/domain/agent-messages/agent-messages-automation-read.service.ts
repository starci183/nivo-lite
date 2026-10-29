import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OptionalLastCustomerMessage } from "./agent-messages-automation-read.contracts"
import { AgentMessageEntity } from "./persistence/entities"

@Injectable()
/** The message reads the automations make: when the customer last wrote, the start of the 48-hour window of Zalo. */
export class AgentMessagesAutomationReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** When the customer last wrote in a conversation, or none. */
    lastCustomerMessage(conversationId: string): Promise<OptionalLastCustomerMessage> {
        return this.entityManager
            .createQueryBuilder(AgentMessageEntity, "m")
            .select("m.created_at", "created_at")
            .where("m.conversation_id = :conversationId AND m.role = 'user'", { conversationId })
            .orderBy("m.created_at", "DESC")
            .limit(1)
            .getRawOne<AutomationLastCustomerMessage>()
    }
}
