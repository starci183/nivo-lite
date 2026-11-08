import { defineAction, type ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { messageRecordOf } from "../chatbot-records"
import { chatbotText } from "../copy"
import { MESSAGES } from "../ports"
import { refusal, writeRefusal } from "./refusal"

/** A person refuses the reply the AI proposed: the line is kept as a rejected one and nothing is sent. */
export const REJECT_PROPOSAL: ActionDefinition = defineAction({
    id: "chatbot.reject-proposal",
    permission: "chatbot.reply",
    label: chatbotText("action_reject_proposal"),
    input: z.object({ id: z.string().min(1).max(MAX_ID) }),
    ports: { messages: MESSAGES },
    transactional: true,
    refreshes: ["chatbot.proposals"],
    run: async ({ messages }, input) => {
        const stored = await messages.get(input.id)
        const line = stored === null ? null : messageRecordOf(stored)
        if (line?.status !== "proposed") return refusal("refused", "proposal_closed")
        const rejected = await messages.update(line.id, line.version, { status: "rejected" })
        return rejected.ok ? { ok: true } : writeRefusal(rejected)
    },
})
