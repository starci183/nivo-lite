import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { chatbotText } from "../copy"
import { routeHoldsPort } from "@nivo-lite/agent-sdk/platform"
import { membersPort } from "../../platform/ports"
import { CONVERSATIONS, NOTES } from "../ports"
import { changeHandling } from "./handling"

/** Hands the conversation to a person: the caller takes it over, so the AI stops answering and the caller may reply. */
export const HANDOFF: ActionDefinition = defineAction({
    id: "blocks-core.chatbot.chat-handoff",
    permission: "chatbot.reply",
    label: chatbotText("action_handoff"),
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
    run: (ports, input, context) => changeHandling(ports, input, context, true),
})
