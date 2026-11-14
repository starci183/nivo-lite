import type { ListedRecord, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { q, type FilterExpr, type Query } from "@nivo-lite/agent-sdk/query"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../../bounds"
import { CHATBOT_CHAT_ENTITY } from "../../../entities/chat/chatbot-entity-names"

/** The longest ISO 8601 text of a time. */
const TIME_MAX = 40

/** The fields of a chat the hear step reads. */
export interface ChatData {
    /** The channel key. */
    readonly channel: string
    /** The core contact the customer is, or null. */
    readonly contactId: string | null
    /** The engine's route the chat is the working state on, or null. */
    readonly routeId: string | null
    /** The customer name. */
    readonly name: string
    /** Where the chat's window on the route's lines starts, ISO 8601, or null. */
    readonly startedAt: string | null
}

/** A nullable text field: an absent key reads as null. */
const nullableText = (max: number): z.ZodType<string | null, unknown> =>
    z
        .string()
        .max(max)
        .nullable()
        .optional()
        .transform((value) => value ?? null)

/** The declared fields of a `blocks-core.chatbot.chat` record the hear step reads. */
const chatDataSchema: z.ZodType<ChatData, unknown> = z.object({
    channel: z.string().max(MAX_ID),
    contactId: nullableText(MAX_ID),
    routeId: nullableText(MAX_ID),
    name: z.string().max(MAX_LINE),
    startedAt: nullableText(TIME_MAX),
})

/** The fields a query for chat rows selects. */
export const CHAT_SELECT: ReadonlyArray<string> = ["channel", "contactId", "routeId", "name", "startedAt"]

/** A chat row with its fields read. */
export interface ConversationFacts {
    /** The record id. */
    readonly id: string
    /** The record version: the token a write expects. */
    readonly version: string
    /** The chat's fields. */
    readonly data: ChatData
}

/** The chat a record holds; null when its fields are not a chat's. */
export const plainFactsOf = (row: RecordRow): ConversationFacts | null => {
    const parsed = chatDataSchema.safeParse(row.data)
    return parsed.success ? { id: row.id, version: row.version, data: parsed.data } : null
}

/** The chat a listed record holds; null when its fields are not a chat's. */
export const factsOf = (listed: Pick<ListedRecord, "row">): ConversationFacts | null => plainFactsOf(listed.row)

/** The condition of the LIVE chat of one route of the engine: the one no `/start` archived (at most one, `route_key`). */
export const liveOfRoute = (routeId: string): FilterExpr => q.and(q.eq("routeId", routeId), q.isNull("archivedAt"))

/** A query for the one chat a key condition selects. */
export const oneConversationQuery = (where: FilterExpr): Query => ({
    from: CHATBOT_CHAT_ENTITY,
    select: CHAT_SELECT,
    where,
    order: [["id", "asc"]],
    page: { size: 1 },
})
