import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { chatbotText } from "../copy"
import { routeHoldsPort } from "@nivo-lite/agent-sdk/platform"
import { membersPort } from "../../platform/ports"
import { CONVERSATIONS, NOTES } from "../ports"
import { changeHandling } from "./handling"

/** Hands the conversation back to the AI: the caller lets go, so the AI answers the next customer line. */
export const RELEASE: ActionDefinition = defineAction({
    id: "blocks-core.chatbot.chat-release",
    permission: "chatbot.reply",
    label: chatbotText("action_release"),
    input: z.object({ id: z.string().min(1).max(MAX_ID), locale: z.enum(["vi", "en"]).optional() }),
    ports: { conversations: CONVERSATIONS, notes: NOTES, members: membersPort, holds: routeHoldsPort },
    transactional: true,
    refreshes: [
        "blocks-core.chatbot.api.chat.list",
        "blocks-core.chatbot.api.chat.get",
        "blocks-core.chatbot.api.message.list",
        "blocks-core.chatbot.api.chat.status-counts",
        "blocks-core.chatbot.api.chat.channel-counts",
    ],
    run: (ports, input, context) => changeHandling(ports, input, context, false),
})
