import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { z } from "zod"
import { MAX_BODY, MAX_ID, MAX_LINE } from "../../shared/bounds"
import { CHAT_MARKS, CHATBOT_CHANNELS } from "./rules"
import type { ChatbotSettings } from "./rules/settings"
import type { ThreadRow } from "./chatbot.types"

/** The longest ISO 8601 text the engine writes for a time. */
const MAX_TIME = 40

/** A value or null, read as null when the engine left the key out. */
const orNull = <T extends z.ZodType>(schema: T) =>
    schema
        .nullable()
        .optional()
        .transform((value) => value ?? null)

const nullableText = (max: number) => orNull(z.string().max(max))

/** The declared fields of a `blocks-core.chatbot.chat` record the module reads. */
const conversationData = z.object({
    name: z.string().max(MAX_LINE),
    channel: z.enum(CHATBOT_CHANNELS),
    contactId: nullableText(MAX_ID),
    routeId: nullableText(MAX_ID),
    startedAt: nullableText(MAX_TIME),
    status: z.enum(CHAT_MARKS),
    waiting: z.boolean(),
    unanswered: z.boolean(),
    avatarUrl: z.string().max(MAX_LINE).nullable().optional(),
    lastAt: nullableText(MAX_TIME),
})

/** The fields a query for conversation rows selects. */
export const CONVERSATION_FIELDS: ReadonlyArray<string> = [
    "name",
    "channel",
    "contactId",
    "routeId",
    "startedAt",
    "status",
    "waiting",
    "unanswered",
    "avatarUrl",
    "lastAt",
]

/** The conversation a record holds; null when its fields are not those of a conversation. */
export const threadRowOf = (record: RecordRow): ThreadRow | null => {
    const parsed = conversationData.safeParse(record.data)
    return parsed.success ? { id: record.id, version: record.version, ...parsed.data } : null
}

/** The declared fields of a `blocks-core.chatbot.settings` record. */
const settingsData = z.object({
    holdingMessage: z.string().max(MAX_BODY),
    updatedBy: nullableText(MAX_LINE),
})

/** The fields a query for the saved rules selects. */
export const SETTINGS_FIELDS: ReadonlyArray<string> = ["scope", "holdingMessage", "updatedBy"]

/** The rules a `blocks-core.chatbot.settings` record holds, with who saved them; null when its fields are not those of the rules. */
export const settingsOf = (record: RecordRow): (ChatbotSettings & { readonly updatedBy: string }) | null => {
    const parsed = settingsData.safeParse(record.data)
    return parsed.success
        ? {
              holdingMessage: parsed.data.holdingMessage,
              updatedBy: parsed.data.updatedBy ?? "",
          }
        : null
}
