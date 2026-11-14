import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"

import { MAX_BODY } from "../../../shared/bounds"
import { CHATBOT_CHAT_ENTITY, CHATBOT_REPLY_ENTITY } from "../../../shared/entities/chatbot-entity-names"

type ReplyFields = {
    readonly conversationId: FieldDef<"uuid", false>
    readonly text: FieldDef<"text", false>
    readonly memberId: FieldDef<"uuid", false>
    readonly key: FieldDef<"uuid", false>
    readonly handedAt: FieldDef<"timestamptz", true>
}

const replyFields: ReplyFields = {
    conversationId: field.uuid(),
    text: field.text({ maxLength: MAX_BODY }),
    memberId: field.uuid(),
    key: field.uuid(),
    handedAt: field.timestamptz({ nullable: true }),
}

/**
 * A reply a member of the shop typed in the workbench, until the delivery job hands it to the engine (the chatbot's own work item, not
 * a customer line). A job payload carries ids only (BE-QUEUES-1), so the words wait here between the action's transaction and the job's
 * door call; the door call is the ONE write of the customer line (the engine's, ruling R26, with the member who typed it), and once it is
 * handed the job empties `text` and stamps `handedAt`, so no copy of a customer line is kept. `key` is the send's once-key.
 */
export const replyEntity: EntityDefinition<ReplyFields> = defineEntity({
    name: CHATBOT_REPLY_ENTITY,
    dataKind: "chat-reply",
    fields: replyFields,
    relations: { conversation: { kind: "toOne", target: CHATBOT_CHAT_ENTITY, required: true, onDelete: "cascade" } },
    indexes: [{ name: "conversation", on: ["conversationId", "id"] }],
    constraints: [{ kind: "unique", name: "send_key", on: ["key"], refusal: "reply-exists" }],
})
