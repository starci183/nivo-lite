import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { outboxPort } from "@nivo-lite/agent-sdk/mutation"
import { z } from "zod"
import { MAX_BODY, MAX_ID } from "../../../bounds"
import { isHeldByPerson, mayHandle, patchAfterLine, replyBodyOf } from "../../../rules/chatbot"
import { membersPort } from "../../platform/ports"
import { threadRowOf } from "../chatbot-records"
import { chatbotText } from "../copy"
import { DELIVER_REPLY } from "../jobs/deliver-reply.job"
import { CONVERSATIONS, MESSAGES } from "../ports"
import { refusal, writeRefusal } from "./refusal"

/**
 * A person reply in a conversation they hold. One transaction: the conversation moves first (a changed version refuses the
 * whole action), then the line is stored and the delivery job is enqueued through the outbox. No channel is called here; the job
 * pushes the line through `door.call("nivo.chat.send")` after the commit.
 */
export const REPLY: ActionDefinition = defineAction({
    id: "chatbot.reply",
    permission: "chatbot.reply",
    label: chatbotText("action_reply"),
    input: z.object({ id: z.string().min(1).max(MAX_ID), text: z.string().max(MAX_BODY) }),
    ports: { conversations: CONVERSATIONS, messages: MESSAGES, members: membersPort, outbox: outboxPort },
    transactional: true,
    refreshes: ["chatbot.messages", "chatbot.threads", "chatbot.thread-counts", "chatbot.channel-counts"],
    run: async ({ conversations, messages, members, outbox }, input, context) => {
        const memberId = context.memberId
        const member = memberId === null ? null : await members.get(memberId)
        if (member === null || memberId === null) return refusal("forbidden", "reply_forbidden")
        const body = replyBodyOf(input.text)
        if (!body.ok) {
            const message = chatbotText(body.reason === "empty" ? "reply_empty" : "reply_too_long")
            return { ok: false, reason: "invalid", message, fields: { text: message } }
        }
        const record = await conversations.get(input.id)
        const conversation = record === null ? null : threadRowOf(record)
        if (conversation === null) return refusal("refused", "reply_not_found")
        if (!isHeldByPerson(conversation.handledBy)) return refusal("refused", "reply_not_held")
        if (!mayHandle(member, conversation.handledBy)) return refusal("forbidden", "reply_held_by_other")
        const at = context.now.toISOString()
        const updated = await conversations.update(conversation.id, conversation.version, {
            ...patchAfterLine(conversation, { role: "agent", text: body.text, at }),
        })
        if (!updated.ok) return writeRefusal(updated)
        const stored = await messages.insert(
            {
                conversationId: conversation.id,
                role: "agent",
                text: body.text,
                sentAt: at,
                authorKind: "human",
                authorName: member.displayName,
                authorUserId: memberId,
            },
            { conversation: conversation.id },
        )
        if (!stored.ok) return writeRefusal(stored)
        await outbox.enqueue(DELIVER_REPLY, { messageId: stored.row.id })
        return { ok: true, data: { messageId: stored.row.id } }
    },
})
