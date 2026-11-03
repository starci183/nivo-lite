import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import type { NodeSchema } from "../node-schema.types"
import { replyKeyOf } from "./reply.policy"
import type { ReplyInput, ReplyOutput } from "./reply.types"

const ID_MAX = 100
const TEXT_MAX = 4000

type NoParams = Record<string, never>

const params: NodeSchema<NoParams> = z.strictObject({})

const input: NodeSchema<ReplyInput> = z.object({
    conversationId: z.string().min(1).max(ID_MAX),
    text: z.string().min(1).max(TEXT_MAX),
})

const output: NodeSchema<ReplyOutput> = z.object({ message: z.object({ kind: z.string(), id: z.string() }) })

/** What the agent must hold for the effect: the host checks it, the node itself reads and writes no data. */
const EFFECT_GRANT = { rights: [{ kind: "message", access: "write", scope: "turn", fields: ["body"] }] } as const

/** `core.reply`: sends a text to the customer's conversation through the channel it came from. Sending the same text twice in a turn sends once. */
export const coreReplyNode: NodeDefinition<
    NodeSchema<ReplyInput>,
    NodeSchema<ReplyOutput>,
    NodeSchema<NoParams>
> = defineNode({
    id: "core.reply",
    role: "output",
    title: { vi: "Trả lời khách", en: "Reply to the customer" },
    params,
    input,
    output,
    rights: [],
    effects: ["channel.send"],
    run: async (given, context) => {
        const message = await context.effect(
            "channel.send",
            { conversationId: given.conversationId, text: given.text },
            { dedupeKey: replyKeyOf(context.turn.turnId, given.text) },
        )
        return { message }
    },
    examples: [
        {
            name: "sends the text to the conversation",
            grant: EFFECT_GRANT,
            params: {},
            input: { conversationId: "c1", text: "Chào bạn, shop có thể giúp gì ạ?" },
            output: { message: { kind: "channel.send", id: "channel.send-1" } },
            effects: [
                {
                    kind: "channel.send",
                    payload: { conversationId: "c1", text: "Chào bạn, shop có thể giúp gì ạ?" },
                },
            ],
        },
    ],
})
