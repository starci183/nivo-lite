"use server"
import "server-only"

import { dbFailure, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { startConversationSchema } from "./agentchat.mapper"

/**
 * Opens a conversation with an agent: the database function checks the caller belongs to the agent workspace, stores the conversation and the
 * agent greeting together, and answers the conversation id.
 */
export const writeStartConversation = async (input: unknown): Promise<DbOutcome<string>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = startConversationSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", `agent-chat-${parsed.field}`)
    const db = await createServerDbClient()
    return toOutcome(
        await db.rpc("agent_chat_start", {
            p_agent: parsed.data.agentId,
            p_kind: parsed.data.kind,
            ...(parsed.data.visitorName === null ? {} : { p_visitor: parsed.data.visitorName }),
        }),
    )
}
