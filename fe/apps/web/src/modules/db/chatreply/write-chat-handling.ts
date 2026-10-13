"use server"
import "server-only"

import { revalidatePath } from "next/cache"
import { takeOverConversation } from "@/lib/flow-actions"
import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { chatHandlingSchema } from "./chatreply.mapper"

/** Who holds the conversation after the change; null means the AI. */
export interface ChatHandlingResult {
    readonly handledBy: string | null
}

/**
 * A person takes the conversation over (the AI goes quiet) or hands it back to the AI. The engine records the change as a
 * line in the conversation; this action only admits a verified member with a well-formed request.
 */
export const writeChatHandling = async (input: unknown): Promise<DbOutcome<ChatHandlingResult>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = chatHandlingSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", `chat-${parsed.field}`)
    const changed = await takeOverConversation(parsed.data.conversationId, parsed.data.takeOver)
    revalidatePath("/", "layout")
    if (!changed.ok) return dbFailure("unavailable", `chat-handling:${changed.error.slice(0, 80)}`)
    return dbOk({ handledBy: changed.data.handled_by })
}
