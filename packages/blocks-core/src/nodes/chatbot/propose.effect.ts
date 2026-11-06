import { defineEffect } from "@nivo-lite/agent-sdk/node"
import type { EffectDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../bounds"
import { REPLY_MAX } from "../../rules/chatbot/reply"

/** A reply the AI drafted for a person to approve, stored in the conversation. */
export interface ProposeReplyPayload {
    /** The conversation the draft belongs to. */
    readonly conversationId: string
    /** The words of the draft. */
    readonly text: string
    /** What the customer asked, so the owner sees what the draft answers. */
    readonly asked: string
}

const proposeReplyPayload: z.ZodType<ProposeReplyPayload> = z.object({
    conversationId: z.string().min(1).max(MAX_ID),
    text: z.string().min(1).max(REPLY_MAX),
    asked: z.string().max(MAX_LINE),
})

/**
 * Stores the AI's reply as a line of the conversation with the status proposed: nothing reaches the customer until a person approves it
 * (`chatbot.approve-and-send`). The subject is the stored line.
 */
export const chatMessageProposeEffect: EffectDefinition<z.ZodType<ProposeReplyPayload>> = defineEffect({
    id: "chat-message.propose",
    title: { key: "effectChatMessagePropose" },
    payload: proposeReplyPayload,
    rights: [{ kind: "message", access: "write", scope: "turn", fields: ["body"] }],
})
