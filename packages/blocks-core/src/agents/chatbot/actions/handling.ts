import type { ActionResult } from "@nivo-lite/agent-sdk/block"
import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import type { RouteHolds } from "@nivo-lite/agent-sdk/platform"
import type { RunContext } from "@nivo-lite/agent-sdk/port"
import type { SpecLocale } from "@nivo-lite/agent-sdk/schema"
import { handlingChangeOf, mayHandle, noticeOf } from "../rules"
import type { MemberDirectory } from "../../../shared/platform/platform.types"
import { threadRowOf } from "../chatbot-records"
import { chatbotCopy } from "../copy"
import { refusal, writeRefusal } from "./refusal"

/** The ports a take-over or a hand-back runs on. */
export interface HandlingPorts {
    /** The conversations (`blocks-core.chatbot.chat`). */
    readonly conversations: EntityApi
    /** The chatbot's notes on a conversation (`blocks-core.chatbot.note`). */
    readonly notes: EntityApi
    /** The members. */
    readonly members: MemberDirectory
    /** The engine's staff hold on a route (`platform.route-holds`, ruling R43): the one place that says who holds the thread. */
    readonly holds: RouteHolds
}

/** What a take-over or a hand-back is asked. */
export interface HandlingInput {
    /** The conversation. */
    readonly id: string
    /** The language of the notice line the conversation shows; Vietnamese when absent. */
    readonly locale?: SpecLocale | undefined
}

/**
 * Takes the conversation's route over for the caller (`takeOver`) or hands it back to the agent, through the ENGINE's staff hold
 * (`platform.route-holds`, ruling R43: the chat stores no holder; while held the engine's send door refuses every AI send, a member's typed
 * reply goes; a hand-back clears the hold and the engine delivers one resume event). The chat's activity stamp (`lastAt`) moves first, so a
 * changed version refuses the whole action before the engine is asked; the visible notice is the chatbot's own note
 * (`blocks-core.chatbot.note`, kind `taken` / `released`: no customer message). Already held that way: nothing changes. A chat with no
 * route, or a route the engine does not know, is refused `reply_not_found`.
 */
export const changeHandling = async (
    ports: HandlingPorts,
    input: HandlingInput,
    context: RunContext,
    takeOver: boolean,
): Promise<ActionResult> => {
    const memberId = context.memberId
    const facts = memberId === null ? null : await ports.members.get(memberId)
    if (facts === null || memberId === null) return refusal("forbidden", "reply_forbidden")
    const member = { memberId, displayName: facts.displayName, isManager: facts.isManager }
    const record = await ports.conversations.get(input.id)
    const conversation = record === null ? null : threadRowOf(record)
    if (conversation === null || conversation.routeId === null) return refusal("refused", "reply_not_found")
    const holder = (await ports.holds.holderOf(conversation.routeId))?.memberId ?? null
    if (!mayHandle(member, holder)) return refusal("forbidden", "reply_held_by_other")
    const change = handlingChangeOf(holder, takeOver, member)
    if (change === "none") return { ok: true, data: { heldBy: holder } }
    const at = context.now.toISOString()
    const updated = await ports.conversations.update(conversation.id, conversation.version, { lastAt: at })
    if (!updated.ok) return writeRefusal(updated)
    if (change === "take") {
        if ((await ports.holds.take(conversation.routeId)) === "not_found") return refusal("refused", "reply_not_found")
    } else if ((await ports.holds.handBack(conversation.routeId)).outcome === "not_found") return refusal("refused", "reply_not_found")
    const notice = noticeOf(chatbotCopy(takeOver ? "notice_taken_over" : "notice_released", input.locale ?? "vi"), member.displayName)
    const stored = await ports.notes.insert(
        { conversationId: conversation.id, kind: takeOver ? "taken" : "released", text: notice, at, memberId },
        { conversation: conversation.id },
    )
    if (!stored.ok) return writeRefusal(stored)
    return { ok: true, data: { heldBy: takeOver ? memberId : null } }
}
