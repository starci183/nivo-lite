import { defineNode, type NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../bounds"
import { bilingualOf, sampleOf } from "../../messages/catalog"
import { REPLY_MAX } from "../../rules/chatbot/reply"
import type { NodeSchema } from "../node-schema.types"
import { draftAsk, draftKeyOf, draftTextOf } from "./draft.policy"
import type { DraftReplyInput, DraftReplyOutput } from "./draft.types"

type NoParams = Record<string, never>

const params: NodeSchema<NoParams> = z.strictObject({})

const input: NodeSchema<DraftReplyInput> = z.object({
    conversationId: z.string().min(1).max(MAX_ID),
    question: z.string().min(1).max(MAX_LINE),
    grounded: z.string().max(REPLY_MAX).nullable(),
})

const output: NodeSchema<DraftReplyOutput> = z.object({
    drafted: z.boolean(),
    messageId: z.string().max(MAX_ID).nullable(),
})

/** What the agent must hold for the effect: the host checks it, the node itself reads and writes no data. */
const EFFECT_GRANT = { rights: [{ kind: "message", access: "write", scope: "turn", fields: ["body"] }] } as const

/**
 * `chatbot.draft-reply`: asks the AI for the reply to a customer's question (rewriting what the public knowledge answered in the shop's
 * voice) and stores it as a line of the conversation with the status proposed. Nothing is sent: the owner approves it in the inbox, and
 * approving is the action `chatbot.approve-and-send`. A draft is stored once per turn and conversation.
 */
export const chatbotDraftReplyNode: NodeDefinition<
    NodeSchema<DraftReplyInput>,
    NodeSchema<DraftReplyOutput>,
    NodeSchema<NoParams>
> = defineNode({
    id: "chatbot.draft-reply",
    role: "output",
    title: bilingualOf("nodeChatbotDraftReplyTitle"),
    params,
    input,
    output,
    rights: [],
    effects: ["chat-message.propose"],
    run: async (given, context) => {
        const written = await context.model.text(draftAsk(given))
        const text = draftTextOf(written, given.grounded)
        if (text === null) return { drafted: false, messageId: null }
        const message = await context.effect(
            "chat-message.propose",
            { conversationId: given.conversationId, text, asked: given.question },
            { dedupeKey: draftKeyOf(context.turn.turnId, given.conversationId) },
        )
        return { drafted: true, messageId: message.id }
    },
    examples: [
        {
            name: "stores the AI's reply as a draft for the owner",
            grant: EFFECT_GRANT,
            params: {},
            input: {
                conversationId: "c1",
                question: sampleOf("sampleDraftQuestion"),
                grounded: sampleOf("sampleDraftGrounded"),
            },
            model: [sampleOf("sampleDraftReply")],
            output: { drafted: true, messageId: "chat-message.propose-1" },
            effects: [
                {
                    kind: "chat-message.propose",
                    payload: {
                        conversationId: "c1",
                        text: sampleOf("sampleDraftReply"),
                        asked: sampleOf("sampleDraftQuestion"),
                    },
                },
            ],
        },
        {
            name: "falls back to the grounded answer when the AI writes nothing",
            grant: EFFECT_GRANT,
            params: {},
            input: {
                conversationId: "c1",
                question: sampleOf("sampleDraftQuestion"),
                grounded: sampleOf("sampleDraftGrounded"),
            },
            model: [""],
            output: { drafted: true, messageId: "chat-message.propose-1" },
            effects: [
                {
                    kind: "chat-message.propose",
                    payload: {
                        conversationId: "c1",
                        text: sampleOf("sampleDraftGrounded"),
                        asked: sampleOf("sampleDraftQuestion"),
                    },
                },
            ],
        },
        {
            name: "stores no draft when neither the AI nor the knowledge has words",
            grant: EFFECT_GRANT,
            params: {},
            input: { conversationId: "c1", question: sampleOf("sampleDraftQuestion"), grounded: null },
            model: ["   "],
            output: { drafted: false, messageId: null },
            effects: [],
        },
    ],
})
