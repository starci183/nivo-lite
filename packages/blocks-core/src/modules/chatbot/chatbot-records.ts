import type { JoinedRecord, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { z } from "zod"
import { MAX_BODY, MAX_ID, MAX_LINE } from "../../bounds"
import { MESSAGE_STATUSES } from "../../entities/chat/message.entity"
import { CHATBOT_CHANNELS, INBOX_STATUSES, TAIL_TEXT_MAX } from "../../rules/chatbot"
import type { LeadFacts, MessageRecord, ThreadRow } from "./chatbot.types"

/** The longest ISO 8601 text the engine writes for a time. */
const MAX_TIME = 40

/** The most spoken lines a conversation counts. */
const MAX_COUNT = 1_000_000_000

/** A value or null, read as null when the engine left the key out. */
const orNull = <T extends z.ZodType>(schema: T) =>
    schema
        .nullable()
        .optional()
        .transform((value) => value ?? null)

const nullableText = (max: number) => orNull(z.string().max(max))

const roles = z.enum(["user", "agent", "system"])

/** The declared fields of a `chat.conversation` record the module reads. */
const conversationData = z.object({
    name: z.string().max(MAX_LINE),
    channel: z.enum(CHATBOT_CHANNELS),
    externalId: nullableText(MAX_ID),
    status: z.enum(INBOX_STATUSES),
    waiting: z.boolean(),
    unanswered: z.boolean(),
    handledBy: nullableText(MAX_LINE),
    handledAt: nullableText(MAX_TIME),
    lastText: z.string().max(TAIL_TEXT_MAX),
    lastRole: orNull(roles),
    lastAt: nullableText(MAX_TIME),
    messageCount: z.number().int().min(0).max(MAX_COUNT),
})

/** The declared fields of a `chat.message` record the module reads. */
const messageData = z.object({
    conversationId: z.string().max(MAX_ID),
    role: roles,
    text: z.string().max(MAX_BODY),
    sentAt: z.string().max(MAX_TIME),
    authorKind: orNull(z.enum(["ai", "human"])),
    authorName: nullableText(MAX_LINE),
    authorUserId: nullableText(MAX_ID),
    status: z
        .enum(MESSAGE_STATUSES)
        .optional()
        .transform((value) => value ?? "posted"),
    deliveryStatus: orNull(z.enum(["sent", "failed"])),
    deliveryError: nullableText(MAX_BODY),
})

/** The fields of the linked `sales.lead` record the customer pane shows. */
const leadData = z.object({
    contactName: z.string().max(MAX_LINE),
    company: nullableText(MAX_LINE),
    stage: z.string().max(MAX_ID),
    need: nullableText(MAX_BODY),
    phone: nullableText(MAX_LINE),
    email: nullableText(MAX_LINE),
})

/** The fields a query for conversation rows selects. */
export const CONVERSATION_FIELDS: ReadonlyArray<string> = [
    "name",
    "channel",
    "externalId",
    "status",
    "waiting",
    "unanswered",
    "handledBy",
    "handledAt",
    "lastText",
    "lastRole",
    "lastAt",
    "messageCount",
]

/** The fields a query for line rows selects. */
export const MESSAGE_FIELDS: ReadonlyArray<string> = [
    "conversationId",
    "role",
    "text",
    "sentAt",
    "authorKind",
    "authorName",
    "authorUserId",
    "status",
    "deliveryStatus",
    "deliveryError",
]

/** The fields a query for the customer behind a conversation selects. */
export const LEAD_FIELDS: ReadonlyArray<string> = ["contactName", "company", "stage", "need", "phone", "email"]

/** The conversation a record holds; null when its fields are not those of a conversation. */
export const threadRowOf = (record: RecordRow): ThreadRow | null => {
    const parsed = conversationData.safeParse(record.data)
    return parsed.success ? { id: record.id, version: record.version, ...parsed.data } : null
}

/** The line a record holds; null when its fields are not those of a line. */
export const messageRecordOf = (record: RecordRow): MessageRecord | null => {
    const parsed = messageData.safeParse(record.data)
    return parsed.success ? { id: record.id, version: record.version, ...parsed.data } : null
}

/** The customer facts a joined `sales.lead` record holds; null when there is no link or its fields are not a customer's. */
export const leadFactsOf = (joined: JoinedRecord | null): LeadFacts | null => {
    const parsed = joined === null ? null : leadData.safeParse(joined.data)
    return parsed?.success === true ? parsed.data : null
}
