import type { ActionResult } from "@nivo-lite/agent-sdk/block"
import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import type { RunContext } from "@nivo-lite/agent-sdk/port"
import type { SpecLocale } from "@nivo-lite/agent-sdk/schema"
import { handlingChangeOf, mayHandle, noticeOf, patchAfterHandling, patchAfterLine } from "../../../rules/chatbot"
import type { MemberDirectory } from "../../platform/platform.types"
import { threadRowOf } from "../chatbot-records"
import { chatbotCopy } from "../copy"
import { refusal, writeRefusal } from "./refusal"

/** The ports a take-over or a release runs on. */
export interface HandlingPorts {
    /** The conversations (`chat.conversation`). */
    readonly conversations: EntityApi
    /** The lines (`chat.message`). */
    readonly messages: EntityApi
    /** The members. */
    readonly members: MemberDirectory
}

/** What a take-over or a release is asked. */
export interface HandlingInput {
    /** The conversation. */
    readonly id: string
    /** The language of the notice line the conversation shows; Vietnamese when absent. */
    readonly locale?: SpecLocale | undefined
}

/**
 * Takes a conversation over under the caller name (`takeOver`) or hands it back to the AI, and writes the visible notice line in
 * the same transaction. The conversation moves first, so a changed version refuses the whole action. Already held that way: nothing
 * changes and the answer says who holds it.
 */
export const changeHandling = async (
    ports: HandlingPorts,
    input: HandlingInput,
    context: RunContext,
    takeOver: boolean,
): Promise<ActionResult> => {
    const member = context.memberId === null ? null : await ports.members.get(context.memberId)
    if (member === null) return refusal("forbidden", "reply_forbidden")
    const record = await ports.conversations.get(input.id)
    const conversation = record === null ? null : threadRowOf(record)
    if (conversation === null) return refusal("refused", "reply_not_found")
    if (!mayHandle(member, conversation.handledBy)) return refusal("forbidden", "reply_held_by_other")
    const change = handlingChangeOf(conversation.handledBy, takeOver, member)
    if (change.kind === "none") return { ok: true, data: { handledBy: conversation.handledBy } }
    const at = context.now.toISOString()
    const held = patchAfterHandling(conversation, change.handledBy)
    const notice = noticeOf(
        chatbotCopy(takeOver ? "notice_taken_over" : "notice_released", input.locale ?? "vi"),
        member.displayName,
    )
    const line = patchAfterLine({ ...conversation, ...held }, { role: "system", text: notice, at })
    const updated = await ports.conversations.update(conversation.id, conversation.version, {
        ...held,
        ...line,
        handledAt: change.handledBy === null ? null : at,
    })
    if (!updated.ok) return writeRefusal(updated)
    const stored = await ports.messages.insert(
        {
            conversationId: conversation.id,
            role: "system",
            text: notice,
            sentAt: at,
            authorKind: null,
            authorName: null,
            authorUserId: null,
        },
        { conversation: conversation.id },
    )
    if (!stored.ok) return writeRefusal(stored)
    return { ok: true, data: { handledBy: change.handledBy } }
}
