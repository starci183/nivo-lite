import { defineAction, type ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { TAKE_OVER_COMMAND } from "../../../rules/chatbot/decisions"
import { chatbotText } from "../copy"
import { membersPort } from "../../platform/ports"
import { CONVERSATIONS, MESSAGES } from "../ports"
import { changeHandling } from "./handling"

/** `chatbot.decide`: the answer of a person to a customer who waits: take the conversation over, as the take-over action does. */
export const DECIDE: ActionDefinition = defineAction({
    id: "chatbot.decide",
    permission: "chatbot.reply",
    label: chatbotText("action_decide"),
    input: z.object({
        id: z.string().min(1).max(MAX_ID),
        command: z.literal(TAKE_OVER_COMMAND),
        locale: z.enum(["vi", "en"]).optional(),
    }),
    ports: { conversations: CONVERSATIONS, messages: MESSAGES, members: membersPort },
    transactional: true,
    refreshes: [
        "chatbot.threads",
        "chatbot.thread",
        "chatbot.messages",
        "chatbot.thread-counts",
        "chatbot.channel-counts",
        "chatbot.figures",
        "chatbot.decisions",
    ],
    run: (ports, { id, locale }, context) => changeHandling(ports, { id, locale }, context, true),
})
