import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { askedOf } from "../../../rules/chatbot/proposal"
import type { ProposalView } from "../chatbot.types"
import { CONVERSATIONS, MESSAGES } from "../ports"

/** `chatbot.proposals`: the reply the AI proposed in one conversation, with what the customer asked; null when none waits. */
export const PROPOSALS: ReadDefinition = defineRead({
    id: "chatbot.proposals",
    dataKind: "message",
    shape: "record",
    fields: ["id", "asked", "text", "note"],
    paths: {},
    variables: z.object({ threadId: z.string().min(1).max(MAX_ID) }),
    permission: "chatbot.view",
    ports: { conversations: CONVERSATIONS, messages: MESSAGES },
    run: async ({ conversations, messages }, { threadId }): Promise<ProposalView | null> => {
        const conversation = await conversations.get(threadId)
        const line = conversation === null ? null : await messages.proposed(threadId)
        if (conversation === null || line === null) return null
        return { id: line.id, asked: askedOf(conversation), text: line.text, note: "" }
    },
})
