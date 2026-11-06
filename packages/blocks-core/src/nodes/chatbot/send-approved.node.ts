import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { MAX_ID } from "../../bounds"
import { bilingualOf, sampleOf } from "../../messages/catalog"
import { REPLY_MAX } from "../../rules/chatbot/reply"
import type { NodeSchema } from "../node-schema.types"
import { approvedKeyOf } from "./draft.policy"
import type { SendApprovedInput, SendApprovedOutput } from "./draft.types"

type NoParams = Record<string, never>

const params: NodeSchema<NoParams> = z.strictObject({})

const input: NodeSchema<SendApprovedInput> = z.object({
    conversationId: z.string().min(1).max(MAX_ID),
    messageId: z.string().min(1).max(MAX_ID),
    text: z.string().min(1).max(REPLY_MAX),
})

const output: NodeSchema<SendApprovedOutput> = z.object({ sentId: z.string().max(MAX_ID) })

/** What the agent must hold for the effect: the host checks it, the node itself reads and writes no data. */
const EFFECT_GRANT = { rights: [{ kind: "message", access: "write", scope: "turn", fields: ["body"] }] } as const

/**
 * `chatbot.send-approved`: sends the reply a person approved. The send goes out through the host's outbox as the job that calls the
 * channel after the commit, keyed by the stored line, so a line approved on two paths (the inbox action and this node) goes out once.
 */
export const chatbotSendApprovedNode: NodeDefinition<
    NodeSchema<SendApprovedInput>,
    NodeSchema<SendApprovedOutput>,
    NodeSchema<NoParams>
> = defineNode({
    id: "chatbot.send-approved",
    role: "output",
    title: bilingualOf("nodeChatbotSendApprovedTitle"),
    params,
    input,
    output,
    rights: [],
    effects: ["channel.send"],
    run: async (given, context) => {
        const sent = await context.effect(
            "channel.send",
            { conversationId: given.conversationId, text: given.text },
            { dedupeKey: approvedKeyOf(given.messageId) },
        )
        return { sentId: sent.id }
    },
    examples: [
        {
            name: "sends the approved words once, keyed by the stored line",
            grant: EFFECT_GRANT,
            params: {},
            input: { conversationId: "c1", messageId: "m1", text: sampleOf("sampleDraftReply") },
            output: { sentId: "channel.send-1" },
            effects: [{ kind: "channel.send", payload: { conversationId: "c1", text: sampleOf("sampleDraftReply") } }],
        },
    ],
})
