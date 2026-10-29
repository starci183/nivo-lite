import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentConversationsReadService } from "@modules/domain/agent-conversations"
import { AgentMessageDeliveriesService } from "@modules/domain/agent-messages"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { AnswerProgressLine, ReplyProgress } from "./work-items-activity.contracts"
import { WorkItemEntity } from "./persistence/entities"

/** The conversation a reply work item names: the proposal's field, else the subject when it is a conversation. */
const conversationOf = (item: WorkItemEntity): string | null => {
    const field = item.proposal?.fields?.conversation_id
    if (typeof field === "string" && field !== "") return field
    return item.subjectType === "conversation" ? item.subjectId : null
}

@Injectable()
/** How far the customer-reply work items got: their state beside the delivery of the stored answer. */
export class WorkItemsReplyProgressService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly conversations: AgentConversationsReadService,
        private readonly deliveries: AgentMessageDeliveriesService,
    ) {}

    /**
     * How far a customer-reply work item got, with the stored answer's delivery; null when the workspace has no such item or its
     * conversation is not a customer conversation.
     */
    async answerProgress(workspaceId: string, workItemId: string): Promise<ReplyProgress> {
        const item = await this.entityManager.findOne(WorkItemEntity, {
            where: { workspaceId, id: workItemId, action: "reply_customer" },
        })
        if (item === null) return null
        const conversationId = conversationOf(item)
        if (conversationId === null) return null
        const chat = await this.conversations.customerChat(workspaceId, conversationId)
        if (chat === null) return null
        const reply = await this.deliveries.humanReplyOf(workspaceId, chat.id, item.id)
        return {
            id: item.id,
            work_status: item.status,
            message_id: reply?.id ?? null,
            delivery_status: reply?.deliveryStatus ?? null,
        }
    }
}
