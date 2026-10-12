"use server"
import "server-only"

import { revalidatePath } from "next/cache"
import { getTranslations } from "next-intl/server"
import { decideWorkItem } from "@/lib/flow-actions"
import { drainAfter, engineCtx } from "@/lib/flow-ctx"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { chatAnswerSchema } from "./chatreply.mapper"

/** Whether the answer reached the customer. */
export interface ChatAnswerResult {
    readonly delivered: boolean
}

/** Channels a reply is pushed to from NIVO. */
const PUSHED: ReadonlyArray<string> = ["telegram", "zalo", "facebook", "instagram"]

/**
 * Answers a waiting escalation as the signed-in member through the normal decision path (permissions, decision log,
 * evidence): the text becomes the approved draft, is posted and delivered. A null text declines to answer.
 */
export const writeChatAnswer = async (input: unknown): Promise<DbOutcome<ChatAnswerResult>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = chatAnswerSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", `chat-${parsed.field}`)
    const { workItemId, conversationId, text } = parsed.data
    const decided = await decideWorkItem(workItemId, text === null ? "rejected" : "approved", text === null ? undefined : { draft: text })
    if (!decided.ok) return dbFailure("refused", `chat-decision:${decided.error.slice(0, 80)}`)
    const context = await engineCtx()
    const attributed =
        text === null
            ? dbOk(false)
            : await attributeAnswer({
                  conversationId,
                  text,
                  workspaceId: context.session.workspace.id,
                  memberName: context.session.member.displayName,
                  summary: decided.data.result?.summary ?? null,
              })
    drainAfter(context)
    revalidatePath("/", "layout")
    if (attributed.kind !== "ok") return attributed
    return dbOk({ delivered: attributed.value })
}

/** The answer that was posted and who gave it. */
interface AnswerLine {
    readonly conversationId: string
    readonly text: string
    readonly workspaceId: string
    readonly memberName: string
    readonly summary: string | null
}

/** The performer stored the answer as an unlabelled line: this attributes it to the member and records honest delivery. */
const attributeAnswer = async (answer: AnswerLine): Promise<DbOutcome<boolean>> => {
    const { conversationId, text, workspaceId, memberName, summary } = answer
    const client = await createServerDbClient()
    const t = await getTranslations("system")
    const found = toOutcome(
        await client
            .from("agent_conversations")
            .select("channel")
            .eq("id", conversationId)
            .eq("workspace_id", workspaceId)
            .limit(1),
    )
    const channel = found.kind === "ok" ? (found.value[0]?.channel ?? null) : null
    const posted = summary === t("replyPostedTelegram")
    const delivered = channel !== null && PUSHED.includes(channel) ? posted : true
    const line = toOutcome(
        await client
            .from("agent_messages")
            .select("id")
            .eq("conversation_id", conversationId)
            .eq("workspace_id", workspaceId)
            .eq("role", "agent")
            .eq("body", text)
            .is("author_kind", null)
            .order("created_at", { ascending: false })
            .limit(1),
    )
    const id = line.kind === "ok" ? line.value[0]?.id : undefined
    if (id === undefined) return dbOk(delivered)
    const marked = toOutcome(
        await client
            .from("agent_messages")
            .update({ author_kind: "human", author_name: memberName, delivery_status: delivered ? "sent" : "failed" })
            .eq("id", id)
            .select("id"),
    )
    if (marked.kind !== "ok") return marked
    return dbOk(delivered)
}
