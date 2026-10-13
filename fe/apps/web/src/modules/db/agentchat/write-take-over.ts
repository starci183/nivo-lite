"use server"
import "server-only"

import { dbFailure, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { takeOverSchema } from "./agentchat.mapper"

/**
 * A person takes a conversation over (the AI goes quiet) or hands it back. The database function records who holds it and adds the given line
 * to the thread (the user placeholder becomes the member's name). The answer is who holds the conversation now, or an empty text for the AI.
 */
export const writeTakeOver = async (input: unknown): Promise<DbOutcome<string>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = takeOverSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", `agent-chat-${parsed.field}`)
    const db = await createServerDbClient()
    return toOutcome(
        await db.rpc("agent_chat_take_over", {
            p_conversation: parsed.data.conversationId,
            p_take: parsed.data.take,
            p_line: parsed.data.line,
        }),
    )
}
