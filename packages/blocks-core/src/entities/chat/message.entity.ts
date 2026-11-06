import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition, FieldDef } from "@nivo-lite/agent-sdk/entity"

import { MAX_BODY, MAX_ID, MAX_LINE } from "../../bounds"

/** The longest delivery error kept. */
const MAX_DELIVERY_ERROR = 1_000

/** Where a line stands: posted in the thread, proposed by the AI for a person to approve, or a proposal that was refused. */
export const MESSAGE_STATUSES: readonly ["posted", "proposed", "rejected"] = ["posted", "proposed", "rejected"]

type MessageFields = {
    readonly conversationId: FieldDef<"uuid", false>
    readonly role: FieldDef<"enum", false>
    readonly text: FieldDef<"text", false>
    readonly sentAt: FieldDef<"timestamptz", false>
    readonly authorKind: FieldDef<"enum", true>
    readonly authorName: FieldDef<"text", true>
    readonly authorUserId: FieldDef<"uuid", true>
    readonly status: FieldDef<"enum", false>
    readonly deliveryStatus: FieldDef<"enum", true>
    readonly deliveryError: FieldDef<"text", true>
    readonly channelRef: FieldDef<"text", true>
    readonly inReplyTo: FieldDef<"uuid", true>
    readonly sentBy: FieldDef<"uuid", true>
}

const messageFields: MessageFields = {
    conversationId: field.uuid(),
    role: field.enum({ of: ["user", "agent", "system"] }),
    text: field.text({ maxLength: MAX_BODY }),
    sentAt: field.timestamptz({ default: "now" }),
    authorKind: field.enum({ of: ["ai", "human"], nullable: true }),
    authorName: field.text({ maxLength: MAX_LINE, nullable: true }),
    authorUserId: field.uuid({ nullable: true }),
    status: field.enum({ of: MESSAGE_STATUSES, default: { literal: "posted" } }),
    deliveryStatus: field.enum({ of: ["sent", "failed"], nullable: true }),
    deliveryError: field.text({ maxLength: MAX_DELIVERY_ERROR, nullable: true }),
    channelRef: field.text({ maxLength: MAX_ID, nullable: true }),
    inReplyTo: field.uuid({ nullable: true }),
    sentBy: field.uuid({ nullable: true }),
}

/** One message of a conversation. Graph node kind `message`. */
export const messageEntity: EntityDefinition<MessageFields> = defineEntity({
    name: "chat.message",
    dataKind: "message",
    fields: messageFields,
    relations: { conversation: { kind: "toOne", target: "chat.conversation", required: true, onDelete: "cascade" } },
    indexes: [
        { name: "conversation_sent", on: ["conversationId", { desc: "sentAt" }, { desc: "id" }] },
        { name: "conversation_status_sent", on: ["conversationId", "status", { desc: "sentAt" }, { desc: "id" }] },
        { name: "channel_ref", on: ["channelRef", "id"] },
        { name: "reply_of", on: ["conversationId", "inReplyTo", { desc: "sentAt" }, { desc: "id" }] },
        { name: "role_recent", on: ["role", { desc: "sentAt" }, { desc: "id" }] },
    ],
    constraints: [
        {
            kind: "unique",
            name: "channel_ref_key",
            on: ["channelRef"],
            where: { op: "notNull", field: "channelRef" },
            refusal: "message-already-stored",
        },
        {
            kind: "unique",
            name: "reply_once_key",
            on: ["conversationId", "inReplyTo"],
            where: {
                op: "and",
                of: [
                    { op: "eq", field: "role", value: "agent" },
                    { op: "notNull", field: "inReplyTo" },
                ],
            },
            refusal: "reply-exists",
        },
        {
            kind: "unique",
            name: "one_proposal_key",
            on: ["conversationId"],
            where: { op: "eq", field: "status", value: "proposed" },
            refusal: "proposal-exists",
        },
    ],
})
