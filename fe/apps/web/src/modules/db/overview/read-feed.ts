import "server-only"

import { cache } from "react"
import type { Message } from "@/lib/types"
import { createServerDbClient } from "../server"
import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { toMessage } from "./overview.mapper"

/** The newest Office messages of one workspace, oldest first, under the caller RLS. */
export const readMessages = cache(async (workspaceId: string, limit: number): Promise<DbOutcome<Array<Message>>> => {
    const client = await createServerDbClient()
    const rows = toOutcome(
        await client
            .from("messages")
            .select("*")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(limit),
    )
    return rows.kind === "ok" ? dbOk(rows.value.map(toMessage).reverse()) : rows
})
