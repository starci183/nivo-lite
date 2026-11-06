import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_BODY, MAX_ID } from "../../../bounds"
import { mayHandle, patchAfterLine, replyBodyOf } from "../../../rules/chatbot"
import { chatbotText } from "../copy"
import { CONVERSATIONS, MEMBERS, MESSAGES, OUTBOX } from "../ports"
import { refusal } from "./refusal"

/**
 * A person approves the reply the AI proposed, with or without changes to its words. One transaction: the conversation moves first
 * (a changed version refuses the whole action), then the line becomes a posted line and the delivery job is enqueued through the
 * outbox. No channel is called here; the job pushes the line through `door.call("chat.send")` after the commit.
 */
export const APPROVE_AND_SEND: ActionDefinition = defineAction({
    id: "chatbot.approve-and-send",
    permission: "chatbot.reply",
    label: chatbotText("action_approve_and_send"),
    input: z.object({ id: z.string().min(1).max(MAX_ID), text: z.string().max(MAX_BODY).optional() }),
    ports: { conversations: CONVERSATIONS, messages: MESSAGES, members: MEMBERS, outbox: OUTBOX },
    transactional: true,
    refreshes: [
        "chatbot.proposals",
        "chatbot.messages",
        "chatbot.threads",
        "chatbot.thread-counts",
        "chatbot.decisions",
    ],
    run: async ({ conversations, messages, members, outbox }, input, context) => {
        const memberId = context.memberId
        const member = memberId === null ? null : await members.get(memberId)
        if (member === null || memberId === null) return refusal("forbidden", "reply_forbidden")
        const line = await messages.get(input.id)
        if (line?.status !== "proposed") return refusal("refused", "proposal_closed")
        const body = replyBodyOf(input.text ?? line.text)
        if (!body.ok) {
            const message = chatbotText(body.reason === "empty" ? "reply_empty" : "reply_too_long")
            return { ok: false, reason: "invalid", message, fields: { text: message } }
        }
        const conversation = await conversations.get(line.conversationId)
        if (conversation === null) return refusal("refused", "reply_not_found")
        if (!mayHandle(member, conversation.handledBy)) return refusal("forbidden", "reply_held_by_other")
        const at = context.now.toISOString()
        const updated = await conversations.update(
            conversation.id,
            conversation.version,
            patchAfterLine(conversation, { role: "agent", text: body.text, at }),
        )
        if (!updated.ok) return refusal("conflict", "handling_conflict")
        const posted = await messages.update(line.id, line.version, { status: "posted", text: body.text, sentAt: at })
        if (!posted.ok) return refusal("conflict", "handling_conflict")
        await outbox.enqueue("chatbot.deliver-reply", { messageId: line.id })
        return { ok: true, data: { messageId: line.id } }
    },
})
