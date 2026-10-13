"use server"
import "server-only"

import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { isUuid, roleOf } from "./agentchat.mapper"
import type { AgentChatMessage } from "./agentchat.mapper"

/** The most messages one thread reads. */
const THREAD_LIMIT = 300

/** The messages of one conversation, oldest first, under the signed-in member's RLS. */
export const readAgentMessages = async (
    conversationId: string,
): Promise<DbOutcome<ReadonlyArray<AgentChatMessage>>> => {
    if (!isUuid(conversationId)) return dbFailure("invalid", "agent-chat-conversation")
    const client = await createServerDbClient()
    const rows = toOutcome(
        await client
            .from("agent_messages")
            .select("id, role, body, created_at")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: true })
            .limit(THREAD_LIMIT),
    )
    if (rows.kind !== "ok") return rows
    return dbOk(
        rows.value.map((row) => ({ id: row.id, role: roleOf(row.role), body: row.body, createdAt: row.created_at })),
    )
}
