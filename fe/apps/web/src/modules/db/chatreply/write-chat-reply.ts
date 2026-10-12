"use server"
import "server-only"

import { revalidatePath } from "next/cache"
import { getTranslations } from "next-intl/server"
import { getSession } from "@/lib/session"
import { deliverToChannel } from "@/lib/telegram"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { chatReplySchema } from "./chatreply.mapper"

/** Whether the reply reached the customer's channel (the website chat reads it in the page itself). */
export interface ChatReplyResult {
    readonly delivery: "sent" | "failed"
}

/** Channels a reply is pushed to from NIVO. */
const PUSHED: ReadonlyArray<string> = ["telegram", "zalo", "facebook", "instagram"]

/** The signed-in member's own reply while they hold the conversation; customers on a pushed channel get it in their chat. */
export const writeChatReply = async (input: unknown): Promise<DbOutcome<ChatReplyResult>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = chatReplySchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", `chat-${parsed.field}`)
    const { conversationId, body } = parsed.data
    const session = await getSession()
    const workspaceId = session.workspace.id
    const client = await createServerDbClient()
    const found = toOutcome(
        await client
            .from("agent_conversations")
            .select("id, channel, lead_id, handled_by")
            .eq("id", conversationId)
            .eq("workspace_id", workspaceId)
            .limit(1),
    )
    if (found.kind !== "ok") return found
    const conversation = found.value[0]
    if (conversation === undefined) return dbFailure("not-found", "chat-conversation")
    if (conversation.handled_by === null) return dbFailure("refused", "chat-not-held")
    const name = session.member.displayName
    const inserted = toOutcome(
        await client
            .from("agent_messages")
            .insert({
                workspace_id: workspaceId,
                conversation_id: conversation.id,
                role: "agent",
                body,
                author_kind: "human",
                author_name: name,
            })
            .select("id")
            .single(),
    )
    if (inserted.kind !== "ok") return inserted
    const sent = await deliverToChannel(client, conversation.id, body)
    const delivery = PUSHED.includes(conversation.channel) && !sent ? "failed" : "sent"
    const marked = toOutcome(
        await client
            .from("agent_messages")
            .update(delivery === "sent" ? { delivery_status: delivery, delivery_error: null } : { delivery_status: delivery })
            .eq("id", inserted.value.id)
            .eq("workspace_id", workspaceId)
            .select("id"),
    )
    if (marked.kind !== "ok") return marked
    const t = await getTranslations("system")
    const logged = toOutcome(
        await client
            .from("events")
            .insert({
                workspace_id: workspaceId,
                lead_id: conversation.lead_id,
                kind: "conversation.human_reply",
                actor: name,
                summary: t("takenOverNoReply"),
                evidence: body,
            })
            .select("id"),
    )
    revalidatePath("/", "layout")
    if (logged.kind !== "ok") return logged
    return dbOk({ delivery })
}
