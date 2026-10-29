import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentConversationEntity } from "@modules/domain/agent-conversations"
import { AgentMessageEntity } from "@modules/domain/agent-messages"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { AnswerProgressLine } from "./work-items-activity.contracts"
import { WorkItemEntity } from "./persistence/entities"

@Injectable()
/** How far the customer-reply work items got: their state beside the delivery of the stored answer. */
export class WorkItemsReplyProgressService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** How far a customer-reply work item got, with the stored answer's delivery; null when the workspace has no such item. */
    async answerProgress(workspaceId: string, workItemId: string): Promise<AnswerProgressLine | null> {
        const row = await this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .select("w.id", "id")
            .addSelect("w.status", "work_status")
            .addSelect("m.id", "message_id")
            .addSelect("m.delivery_status", "delivery_status")
            .innerJoin(
                AgentConversationEntity,
                "c",
                "c.id::text = COALESCE(NULLIF(w.proposal -> 'fields' ->> 'conversation_id', ''), CASE WHEN w.subject_type = 'conversation' THEN w.subject_id::text ELSE NULL END) AND c.workspace_id = w.workspace_id AND c.kind = 'customer'",
            )
            .leftJoin(
                AgentMessageEntity,
                "m",
                "m.id = w.id AND m.workspace_id = w.workspace_id AND m.conversation_id = c.id AND m.author_kind = 'human'",
            )
            .where("w.workspace_id = :workspaceId AND w.id = :workItemId AND w.action = 'reply_customer'", {
                workspaceId,
                workItemId,
            })
            .limit(1)
            .getRawOne<AnswerProgressLine>()
        return row ?? null
    }
}
