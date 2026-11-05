import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition, FieldDef } from "@nivo-lite/agent-sdk/entity"

import { MAX_ID, MAX_LINE } from "../../bounds"
import { LEAD_CHANNELS } from "../sales/lead.entity"

/** Whether a member has taken the conversation over. */
export const CONVERSATION_STATUSES: readonly [string, ...Array<string>] = ["open", "handled"]

type ConversationFields = {
    readonly kind: FieldDef<"enum", false>
    readonly channel: FieldDef<"enum", false>
    readonly externalId: FieldDef<"text", true>
    readonly visitorName: FieldDef<"text", true>
    readonly status: FieldDef<"enum", false>
    readonly handledBy: FieldDef<"text", true>
    readonly handledAt: FieldDef<"timestamptz", true>
    readonly agentId: FieldDef<"uuid", true>
    readonly frontAgentId: FieldDef<"uuid", true>
}

const conversationFields: ConversationFields = {
    kind: field.enum({ of: ["customer", "test"], default: { literal: "customer" } }),
    channel: field.enum({ of: LEAD_CHANNELS, default: { literal: "website" } }),
    externalId: field.text({ maxLength: MAX_ID, nullable: true }),
    visitorName: field.text({ maxLength: MAX_LINE, searchable: true, nullable: true }),
    status: field.enum({ of: CONVERSATION_STATUSES, default: { literal: "open" } }),
    handledBy: field.text({ maxLength: MAX_LINE, nullable: true }),
    handledAt: field.timestamptz({ nullable: true }),
    agentId: field.uuid({ nullable: true }),
    frontAgentId: field.uuid({ nullable: true }),
}

/** One conversation of an agent with a visitor or customer. Graph node kind `conversation`. */
export const conversationEntity: EntityDefinition<ConversationFields> = defineEntity({
    name: "chat.conversation",
    dataKind: "conversation",
    fields: conversationFields,
    relations: {
        lead: { kind: "toOne", target: "sales.lead" },
        messages: { kind: "toMany", target: "chat.message", onDelete: "cascade" },
    },
    indexes: [
        { name: "recent", on: [{ desc: "updatedAt" }, { desc: "id" }] },
        { name: "channel_recent", on: ["channel", { desc: "updatedAt" }, { desc: "id" }] },
        { name: "status_recent", on: ["status", { desc: "updatedAt" }, { desc: "id" }] },
    ],
    constraints: [
        {
            kind: "unique",
            name: "channel_external_key",
            on: ["channel", "externalId"],
            where: { op: "notNull", field: "externalId" },
            refusal: "conversation-exists",
        },
    ],
})
