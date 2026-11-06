import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition, FieldDef } from "@nivo-lite/agent-sdk/entity"

import { MAX_ID, MAX_LINE } from "../../bounds"
import { LEAD_CHANNELS } from "../sales/lead.entity"

/** Where a conversation stands in the inbox: the AI answers, a customer waits for a person, or a person holds it. */
export const CONVERSATION_STATUSES: readonly [string, ...Array<string>] = ["ai", "needs", "handled"]

/** The roles of a spoken line. */
export const CONVERSATION_LAST_ROLES: readonly [string, ...Array<string>] = ["user", "agent", "system"]

/** The longest preview of the last line: the 140 characters of the preview rule, plus its ellipsis. */
const MAX_LAST_TEXT = 142

type ConversationFields = {
    readonly channel: FieldDef<"enum", false>
    readonly leadId: FieldDef<"uuid", true>
    readonly connectionId: FieldDef<"uuid", true>
    readonly externalId: FieldDef<"text", true>
    readonly name: FieldDef<"text", false>
    readonly status: FieldDef<"enum", false>
    readonly waiting: FieldDef<"bool", false>
    readonly unanswered: FieldDef<"bool", false>
    readonly handledBy: FieldDef<"text", true>
    readonly handledAt: FieldDef<"timestamptz", true>
    readonly lastText: FieldDef<"text", false>
    readonly lastRole: FieldDef<"enum", true>
    readonly lastAt: FieldDef<"timestamptz", true>
    readonly messageCount: FieldDef<"int", false>
    readonly agentId: FieldDef<"uuid", true>
    readonly frontAgentId: FieldDef<"uuid", true>
    readonly connectorPartyId: FieldDef<"text", true>
    readonly connectorPartyName: FieldDef<"text", true>
}

const conversationFields: ConversationFields = {
    channel: field.enum({ of: LEAD_CHANNELS, default: { literal: "website" } }),
    leadId: field.uuid({ nullable: true }),
    connectionId: field.uuid({ nullable: true }),
    externalId: field.text({ maxLength: MAX_ID, nullable: true }),
    name: field.text({ maxLength: MAX_LINE, searchable: true, default: "empty" }),
    status: field.enum({ of: CONVERSATION_STATUSES, default: { literal: "ai" } }),
    waiting: field.bool({ default: { literal: false } }),
    unanswered: field.bool({ default: { literal: false } }),
    handledBy: field.text({ maxLength: MAX_LINE, nullable: true }),
    handledAt: field.timestamptz({ nullable: true }),
    lastText: field.text({ maxLength: MAX_LAST_TEXT, searchable: true, default: "empty" }),
    lastRole: field.enum({ of: CONVERSATION_LAST_ROLES, nullable: true }),
    lastAt: field.timestamptz({ nullable: true }),
    messageCount: field.int({ default: { literal: 0 } }),
    agentId: field.uuid({ nullable: true }),
    frontAgentId: field.uuid({ nullable: true }),
    connectorPartyId: field.text({ maxLength: MAX_ID, nullable: true }),
    connectorPartyName: field.text({ maxLength: MAX_LINE, nullable: true }),
}

/**
 * One conversation of an agent with a visitor or customer. Graph node kind `conversation`. The inbox lists, filters, sorts and
 * searches on stored fields only, so the tail of the last lines (`lastText`, `lastRole`, `lastAt`, `messageCount`) and the marks
 * (`status`, `unanswered`) are written with every line by the Chatbot rules.
 */
export const conversationEntity: EntityDefinition<ConversationFields> = defineEntity({
    name: "chat.conversation",
    dataKind: "conversation",
    fields: conversationFields,
    relations: {
        lead: { kind: "toOne", target: "sales.lead" },
        messages: { kind: "toMany", target: "chat.message", onDelete: "cascade" },
    },
    indexes: [
        { name: "key", on: ["id"] },
        { name: "recent", on: [{ desc: "lastAt" }, { desc: "id" }] },
        { name: "lead_recent", on: ["leadId", { desc: "lastAt" }, { desc: "id" }] },
        { name: "channel_recent", on: ["channel", { desc: "lastAt" }, { desc: "id" }] },
        { name: "status_recent", on: ["status", { desc: "lastAt" }, { desc: "id" }] },
        { name: "status_channel_recent", on: ["status", "channel", { desc: "lastAt" }, { desc: "id" }] },
        { name: "customer", on: ["channel", "connectionId", "externalId", "id"] },
        { name: "connection_recent", on: ["channel", "connectionId", { desc: "lastAt" }, { desc: "id" }] },
    ],
    constraints: [
        {
            kind: "unique",
            name: "channel_external_key",
            on: ["channel", "connectionId", "externalId"],
            where: { op: "notNull", field: "externalId" },
            refusal: "conversation-exists",
        },
    ],
    matchKeys: [{ name: "channel_external", on: ["channel", "connectionId", "externalId"] }],
})
