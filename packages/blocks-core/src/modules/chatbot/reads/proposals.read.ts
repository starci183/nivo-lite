import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { q } from "@nivo-lite/agent-sdk/query"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { askedOf } from "../../../rules/chatbot/proposal"
import { MESSAGE_FIELDS, messageRecordOf, threadRowOf } from "../chatbot-records"
import type { ProposalView } from "../chatbot.types"
import { CONVERSATIONS, MESSAGES } from "../ports"

/** `chatbot.proposals`: the newest reply the AI proposed in one conversation, with what the customer asked; null when none waits. */
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
        const found = await conversations.get(threadId)
        const conversation = found === null ? null : threadRowOf(found)
        if (conversation === null) return null
        const page = await messages.list({
            select: MESSAGE_FIELDS,
            where: q.and(q.eq("conversationId", threadId), q.eq("status", "proposed")),
            order: [
                ["sentAt", "desc"],
                ["id", "desc"],
            ],
            page: { size: 1 },
        })
        const [first] = page.rows
        const line = first === undefined ? null : messageRecordOf(first.row)
        if (line === null) return null
        return { id: line.id, asked: askedOf(conversation), text: line.text, note: "" }
    },
})
