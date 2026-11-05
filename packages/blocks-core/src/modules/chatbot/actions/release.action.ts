import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { chatbotText } from "../copy"
import { membersPort } from "../../platform/ports"
import { CONVERSATIONS, MESSAGES } from "../ports"
import { changeHandling } from "./handling"

/** Hands the conversation back to the AI: the caller lets go, so the AI answers the next customer line. */
export const RELEASE: ActionDefinition = defineAction({
    id: "chatbot.release",
    permission: "chatbot.reply",
    label: chatbotText("action_release"),
    input: z.object({ id: z.string().min(1).max(MAX_ID), locale: z.enum(["vi", "en"]).optional() }),
    ports: { conversations: CONVERSATIONS, messages: MESSAGES, members: membersPort },
    transactional: true,
    refreshes: [
        "chatbot.threads",
        "chatbot.thread",
        "chatbot.messages",
        "chatbot.thread-counts",
        "chatbot.channel-counts",
    ],
    run: (ports, input, context) => changeHandling(ports, input, context, false),
})
