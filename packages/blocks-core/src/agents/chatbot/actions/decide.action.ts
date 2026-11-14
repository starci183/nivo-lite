import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../shared/bounds"
import { TAKE_OVER_COMMAND } from "../rules/decisions"
import { chatbotText } from "../copy"
import { routeHoldsPort } from "@nivo-lite/agent-sdk/platform"
import { membersPort } from "../../../shared/platform/ports"
import { CONVERSATIONS, NOTES } from "../ports"
import { changeHandling } from "./handling"

/** `blocks-core.chatbot.chat-decide`: the answer of a person to a customer who waits: take the conversation over, as the take-over action does. */
export const DECIDE: ActionDefinition = defineAction({
    id: "blocks-core.chatbot.chat-decide",
    permission: "chatbot.reply",
    label: chatbotText("action_decide"),
    input: z.object({
        id: z.string().min(1).max(MAX_ID),
        command: z.literal(TAKE_OVER_COMMAND),
        locale: z.enum(["vi", "en"]).optional(),
    }),
    ports: { conversations: CONVERSATIONS, notes: NOTES, members: membersPort, holds: routeHoldsPort },
    transactional: true,
    refreshes: [
        "blocks-core.chatbot.api.chat.list",
        "blocks-core.chatbot.api.chat.get",
        "blocks-core.chatbot.api.message.list",
        "blocks-core.chatbot.api.chat.status-counts",
        "blocks-core.chatbot.api.chat.channel-counts",
        "blocks-core.chatbot.api.chat.figures",
        "blocks-core.chatbot.api.chat.waiting",
    ],
    run: (ports, { id, locale }, context) => changeHandling(ports, { id, locale }, context, true),
})
