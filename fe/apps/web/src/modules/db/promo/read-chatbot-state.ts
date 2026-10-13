"use server"
import "server-only"

import type { ChatbotState } from "@/modules/promo"
import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { readActiveWorkspace } from "../workspace/read-active-workspace"

const NONE: ChatbotState = { hasChatbot: false, agentId: null, handle: null, name: null }

/** The chatbot agent of the active workspace (module = chatbot), or an empty state. Real rows only; a client hook calls it as an action. */
export const readChatbotState = async (): Promise<DbOutcome<ChatbotState>> => {
    const workspace = await readActiveWorkspace()
    if (workspace.kind !== "ok") return workspace
    const client = await createServerDbClient()
    const rows = toOutcome(
        await client
            .from("agents")
            .select("id, handle, name")
            .eq("workspace_id", workspace.value.id)
            .eq("module", "chatbot")
            .order("created_at", { ascending: true })
            .limit(1),
    )
    if (rows.kind !== "ok") return rows
    const row = rows.value[0]
    return dbOk(row === undefined ? NONE : { hasChatbot: true, agentId: row.id, handle: row.handle, name: row.name })
}
