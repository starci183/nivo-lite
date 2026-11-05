import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { chatbotText } from "../copy"
import { membersPort } from "../../platform/ports"
import { CONVERSATIONS, MESSAGES } from "../ports"
import { changeHandling } from "./handling"

/** Hands the conversation to a person: the caller takes it over, so the AI stops answering and the caller may reply. */
export const HANDOFF: ActionDefinition = defineAction({
    id: "chatbot.handoff",
    permission: "chatbot.reply",
    label: chatbotText("action_handoff"),
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
    run: (ports, input, context) => changeHandling(ports, input, context, true),
})
