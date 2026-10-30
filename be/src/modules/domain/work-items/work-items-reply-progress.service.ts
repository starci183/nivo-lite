import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OptionalReplyItem } from "./work-items-activity.contracts"
import { WorkItemEntity } from "./persistence/entities"

/** The conversation a reply work item names: the proposal's field, else the subject when it is a conversation. */
const conversationOf = (item: WorkItemEntity): string | null => {
    const field = item.proposal?.fields?.conversation_id
    if (typeof field === "string" && field !== "") return field
    return item.subjectType === "conversation" ? item.subjectId : null
}

@Injectable()
/** The customer-reply work items: their state and the conversation each names. */
export class WorkItemsReplyProgressService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /**
     * The customer-reply work item with the conversation it names; null when the workspace has no such item or the item names no
     * conversation.
     */
    async replyItemOf(workspaceId: string, workItemId: string): Promise<OptionalReplyItem> {
        const item = await this.entityManager.findOne(WorkItemEntity, {
            where: { workspaceId, id: workItemId, action: "reply_customer" },
        })
        if (item === null) return null
        const conversationId = conversationOf(item)
        return conversationId === null ? null : { id: item.id, status: item.status, conversationId }
    }
}
