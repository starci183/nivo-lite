import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { outboxPort } from "@nivo-lite/agent-sdk/mutation"
import { routeHoldsPort } from "@nivo-lite/agent-sdk/platform"
import { z } from "zod"
import { MAX_BODY, MAX_ID } from "../../../bounds"
import { isHeldByPerson, mayHandle, replyBodyOf } from "../../../rules/chatbot"
import { membersPort } from "../../platform/ports"
import { threadRowOf } from "../chatbot-records"
import { chatbotText } from "../copy"
import { DELIVER_REPLY } from "../jobs/deliver-reply.job"
import { CONVERSATIONS, REPLIES } from "../ports"
import { refusal, writeRefusal } from "./refusal"

/**
 * A person's reply in a conversation they hold (the engine's route hold names them, or a manager: ruling R43). One transaction: the conversation moves first (answered, its activity stamp; a changed
 * version refuses the whole action), then the words wait as the chatbot's reply work item (`blocks-core.chatbot.reply`, with the member
 * and a send key made once here: a job payload carries ids only, BE-QUEUES-1) and the delivery job is enqueued with its id. The chatbot
 * writes no customer line (ruling R26): the job's door call is the ONE write of the reply, the engine's line with the member who typed
 * it, and the thread shows it from there. No channel is called here.
 */
export const REPLY: ActionDefinition = defineAction({
    id: "blocks-core.chatbot.chat-reply",
    permission: "chatbot.reply",
    label: chatbotText("action_reply"),
    input: z.object({ id: z.string().min(1).max(MAX_ID), text: z.string().max(MAX_BODY) }),
    ports: { conversations: CONVERSATIONS, replies: REPLIES, members: membersPort, outbox: outboxPort, holds: routeHoldsPort },
    transactional: true,
    refreshes: [
        "blocks-core.chatbot.api.message.list",
        "blocks-core.chatbot.api.chat.list",
        "blocks-core.chatbot.api.chat.status-counts",
        "blocks-core.chatbot.api.chat.channel-counts",
    ],
    run: async ({ conversations, replies, members, outbox, holds }, input, context) => {
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
        if (conversation === null || conversation.routeId === null) return refusal("refused", "reply_not_found")
        // Who holds the thread is the engine's route hold (ruling R43); the chat stores no holder.
        const holder = (await holds.holderOf(conversation.routeId))?.memberId ?? null
        if (!isHeldByPerson(holder)) return refusal("refused", "reply_not_held")
        if (!mayHandle({ memberId, displayName: member.displayName, isManager: member.isManager }, holder))
            return refusal("forbidden", "reply_held_by_other")
        const updated = await conversations.update(conversation.id, conversation.version, {
            unanswered: false,
            lastAt: context.now.toISOString(),
        })
        if (!updated.ok) return writeRefusal(updated)
        const stored = await replies.insert(
            { conversationId: conversation.id, text: body.text, memberId, key: globalThis.crypto.randomUUID() },
            { conversation: conversation.id },
        )
        if (!stored.ok) return writeRefusal(stored)
        await outbox.enqueue(DELIVER_REPLY, { replyId: stored.row.id })
        return { ok: true, data: { replyId: stored.row.id } }
    },
})
