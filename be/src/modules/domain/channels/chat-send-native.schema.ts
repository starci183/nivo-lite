import { z } from "zod"
import type { GatewayJson } from "@modules/domain/mcp-gateway"

/** The bounded arguments of `chat.send`. */
export const CHAT_SEND_SCHEMA: z.ZodType<{
    readonly conversationId: string
    readonly text: string
    readonly key: string
}> = z
    .object({
        conversationId: z.uuid(),
        text: z.string().min(1).max(20_000),
        key: z.string().min(1).max(200),
    })
    .strict()

/** The schema `chat.send` announces, generated from its validator. */
export const CHAT_SEND_INPUT_SCHEMA: GatewayJson = z.toJSONSchema(CHAT_SEND_SCHEMA, { io: "input" })

/** The arguments of `chat.send`: the text to say in one conversation, once under its key. */
export type ChatSendInput = z.output<typeof CHAT_SEND_SCHEMA>

/** The bounded arguments of `chat.profile`: the conversation whose customer is asked about. */
export const CHAT_PROFILE_SCHEMA: z.ZodType<{ readonly conversationId: string }> = z
    .object({ conversationId: z.uuid() })
    .strict()

/** The schema `chat.profile` announces, generated from its validator. */
export const CHAT_PROFILE_INPUT_SCHEMA: GatewayJson = z.toJSONSchema(CHAT_PROFILE_SCHEMA, { io: "input" })
