import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OptionalHumanReplyDelivery } from "./agent-message-deliveries.contracts"
import { AgentMessageEntity } from "./persistence/entities"

@Injectable()
/** The delivery state of the human replies stored in a conversation. */
export class AgentMessageDeliveriesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The human reply with this id in the conversation of the workspace; null when there is none. */
    async humanReplyOf(
        workspaceId: string,
        conversationId: string,
        messageId: string,
    ): Promise<OptionalHumanReplyDelivery> {
        const row = await this.entityManager.findOne(AgentMessageEntity, {
            select: { id: true, deliveryStatus: true },
            where: { workspaceId, conversationId, id: messageId, authorKind: "human" },
        })
        return row === null ? null : { id: row.id, deliveryStatus: row.deliveryStatus }
    }
}
