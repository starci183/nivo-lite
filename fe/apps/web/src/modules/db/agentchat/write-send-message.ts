"use server"
import "server-only"

import { dbFailure, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { sendMessageSchema } from "./agentchat.mapper"

/**
 * Stores a message in a conversation and queues what follows: the database function stores the message and the chat-turn job together, so the
 * back end answers a customer message (the answer arrives on the thread through Realtime) or delivers the reply of a person who holds the
 * conversation. The answer is the id of the stored message.
 */
export const writeSendMessage = async (input: unknown): Promise<DbOutcome<string>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = sendMessageSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", `agent-chat-${parsed.field}`)
    const db = await createServerDbClient()
    return toOutcome(
        await db.rpc("agent_chat_send", { p_conversation: parsed.data.conversationId, p_body: parsed.data.body }),
    )
}
