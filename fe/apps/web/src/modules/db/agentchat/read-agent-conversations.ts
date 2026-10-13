"use server"
import "server-only"

import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { isUuid, kindOf } from "./agentchat.mapper"
import type { AgentChatConversation } from "./agentchat.mapper"

/** The most conversations the history list reads. */
const LIST_LIMIT = 100

/** The conversations of one agent, newest first, under the signed-in member's RLS. */
export const readAgentConversations = async (
    agentId: string,
): Promise<DbOutcome<ReadonlyArray<AgentChatConversation>>> => {
    if (!isUuid(agentId)) return dbFailure("invalid", "agent-chat-agent")
    const client = await createServerDbClient()
    const rows = toOutcome(
        await client
            .from("agent_conversations")
            .select("id, kind, channel, visitor_name, lead_id, handled_by, created_at")
            .eq("agent_id", agentId)
            .order("created_at", { ascending: false })
            .limit(LIST_LIMIT),
    )
    if (rows.kind !== "ok") return rows
    return dbOk(
        rows.value.map((row) => ({
            id: row.id,
            kind: kindOf(row.kind),
            channel: row.channel,
            visitorName: row.visitor_name,
            leadId: row.lead_id,
            handledBy: row.handled_by,
            createdAt: row.created_at,
        })),
    )
}
