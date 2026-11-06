import { z } from "zod"
import type { ConversationData, MessageData } from "./chat-records.contracts"

/** The longest id text a record holds. */
const ID_MAX = 200

/** The longest line of text (names, holders, party names). */
const LINE_MAX = 500

/** The longest message text. */
const BODY_MAX = 20_000

/** The longest ISO 8601 text of a time. */
const TIME_MAX = 40

/** The most spoken lines a conversation counts. */
const COUNT_MAX = 1_000_000_000

const roles = z.enum(["user", "agent", "system"])

/** The declared fields of a `chat.conversation` record this capability reads; an absent nullable key reads as null. */
export const conversationDataSchema: z.ZodType<ConversationData> = z.object({
    channel: z.string().max(ID_MAX),
    connectionId: z
        .string()
        .max(ID_MAX)
        .nullable()
        .optional()
        .transform((value) => value ?? null),
    externalId: z
        .string()
        .max(ID_MAX)
        .nullable()
        .optional()
        .transform((value) => value ?? null),
    name: z.string().max(LINE_MAX),
    waiting: z.boolean(),
    handledBy: z
        .string()
        .max(LINE_MAX)
        .nullable()
        .optional()
        .transform((value) => value ?? null),
    lastText: z.string().max(LINE_MAX),
    lastRole: roles
        .nullable()
        .optional()
        .transform((value) => value ?? null),
    lastAt: z
        .string()
        .max(TIME_MAX)
        .nullable()
        .optional()
        .transform((value) => value ?? null),
    messageCount: z.number().int().min(0).max(COUNT_MAX),
    agentId: z
        .string()
        .max(ID_MAX)
        .nullable()
        .optional()
        .transform((value) => value ?? null),
    frontAgentId: z
        .string()
        .max(ID_MAX)
        .nullable()
        .optional()
        .transform((value) => value ?? null),
    connectorPartyId: z
        .string()
        .max(ID_MAX)
        .nullable()
        .optional()
        .transform((value) => value ?? null),
    connectorPartyName: z
        .string()
        .max(LINE_MAX)
        .nullable()
        .optional()
        .transform((value) => value ?? null),
})

/** The declared fields of a `chat.message` record this capability reads; an absent nullable key reads as null. */
export const messageDataSchema: z.ZodType<MessageData> = z.object({
    conversationId: z.string().max(ID_MAX),
    role: roles,
    text: z.string().max(BODY_MAX),
    sentAt: z.string().max(TIME_MAX),
    deliveryStatus: z
        .enum(["sent", "failed"])
        .nullable()
        .optional()
        .transform((value) => value ?? null),
    deliveryError: z
        .string()
        .max(LINE_MAX)
        .nullable()
        .optional()
        .transform((value) => value ?? null),
    channelRef: z
        .string()
        .max(ID_MAX)
        .nullable()
        .optional()
        .transform((value) => value ?? null),
})
