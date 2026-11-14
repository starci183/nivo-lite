import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"

import { MAX_LINE } from "../../bounds"
import { LEAD_CHANNELS } from "../sales/lead.entity"
import { CHATBOT_CHAT_ENTITY } from "./chatbot-entity-names"

/**
 * The stored mark of a conversation in the inbox: the AI answers, or a customer waits for a person. Who holds the thread is the engine's
 * route hold (ruling R43): `handled` is shown from the route, never stored here.
 */
export const CONVERSATION_STATUSES: readonly [string, ...Array<string>] = ["ai", "needs"]

type ConversationFields = {
    readonly channel: FieldDef<"enum", false>
    readonly contactId: FieldDef<"contact", true>
    readonly routeId: FieldDef<"uuid", true>
    readonly name: FieldDef<"text", false>
    readonly status: FieldDef<"enum", false>
    readonly waiting: FieldDef<"bool", false>
    readonly unanswered: FieldDef<"bool", false>
    readonly lastAt: FieldDef<"timestamptz", true>
    readonly avatarUrl: FieldDef<"text", true>
    readonly profileAt: FieldDef<"timestamptz", true>
    readonly profileTriedAt: FieldDef<"timestamptz", true>
    readonly startedAt: FieldDef<"timestamptz", false>
    readonly archivedAt: FieldDef<"timestamptz", true>
}

const conversationFields: ConversationFields = {
    channel: field.enum({ of: LEAD_CHANNELS, default: { literal: "website" } }),
    contactId: field.contact({ nullable: true }),
    routeId: field.uuid({ nullable: true }),
    name: field.text({ maxLength: MAX_LINE, searchable: true, default: "empty" }),
    status: field.enum({ of: CONVERSATION_STATUSES, default: { literal: "ai" } }),
    waiting: field.bool({ default: { literal: false } }),
    unanswered: field.bool({ default: { literal: false } }),
    lastAt: field.timestamptz({ nullable: true }),
    avatarUrl: field.text({ maxLength: MAX_LINE, nullable: true }),
    profileAt: field.timestamptz({ nullable: true }),
    profileTriedAt: field.timestamptz({ nullable: true }),
    startedAt: field.timestamptz({ default: "now" }),
    archivedAt: field.timestamptz({ nullable: true }),
}

/**
 * One conversation of the chatbot with a visitor or customer: the chatbot's working state on one route of the engine (a question waits
 * for a person, unanswered). Who holds the thread is NOT here: the staff hold is the engine's, on the route (ruling R43, no dual copy;
 * the chatbot takes and hands back through `platform.route-holds` and its reads ask the route). Graph node kind `conversation`. `routeId` is the engine's route (`customer_routes`): at most one
 * LIVE chat per route (`archivedAt` null, `route_key`). A Telegram `/start` (a fresh visit) archives the live chat and the next one starts
 * at `startedAt`: the chatbot's own window on the route's lines. The words of the conversation are the engine's alone (ruling R26): the
 * chat copies no line, no preview and no count; `lastAt` is the chatbot's own activity stamp, the order of the inbox.
 */
export const conversationEntity: EntityDefinition<ConversationFields> = defineEntity({
    name: CHATBOT_CHAT_ENTITY,
    dataKind: "conversation",
    fields: conversationFields,
    indexes: [
        { name: "key", on: ["id"] },
        { name: "route", on: ["routeId", "id"] },
        { name: "recent", on: [{ desc: "lastAt" }, { desc: "id" }] },
        { name: "contact_created", on: ["contactId", { desc: "createdAt" }, { desc: "id" }] },
        { name: "contact_recent", on: ["contactId", { desc: "lastAt" }, { desc: "id" }] },
        { name: "channel_recent", on: ["channel", { desc: "lastAt" }, { desc: "id" }] },
        { name: "status_recent", on: ["status", { desc: "lastAt" }, { desc: "id" }] },
        { name: "status_channel_recent", on: ["status", "channel", { desc: "lastAt" }, { desc: "id" }] },
    ],
    constraints: [
        {
            kind: "unique",
            name: "route_key",
            on: ["routeId"],
            where: { op: "and", of: [{ op: "notNull", field: "routeId" }, { op: "isNull", field: "archivedAt" }] },
            refusal: "conversation-exists",
        },
    ],
})
