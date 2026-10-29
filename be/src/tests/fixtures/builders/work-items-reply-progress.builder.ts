import { entityOf } from "./entity.builder"
import { workItemsEntities } from "@modules/domain/work-items"

const [WorkItemEntity] = workItemsEntities

/** A customer-reply work item that names its conversation through its subject. */
export const replyItemOf = entityOf(WorkItemEntity, {
    id: "w1",
    workspaceId: "ws",
    action: "reply_customer",
    status: "done",
    subjectType: "conversation",
    subjectId: "c-subject",
    proposal: { summary: "", fields: {} },
})

/** A customer-reply work item whose proposal names the conversation. */
export const replyItemNaming = (conversationId: string) =>
    replyItemOf({ proposal: { summary: "", fields: { conversation_id: conversationId } } })

/** A reply work item about a lead: it names no conversation. */
export const replyItemWithoutConversation = () => replyItemOf({ subjectType: "lead", subjectId: null })
