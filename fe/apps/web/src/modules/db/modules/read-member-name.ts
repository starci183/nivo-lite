import "server-only"

import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"

/** Reads the display name the signed-in member goes by in a workspace (for events and confirmations). */
export const readMemberName = async (workspaceId: string, userId: string): Promise<DbOutcome<string>> => {
    const client = await createServerDbClient()
    const result = toOutcome(
        await client
            .from("workspace_members")
            .select("display_name")
            .eq("workspace_id", workspaceId)
            .eq("user_id", userId)
            .eq("status", "active")
            .maybeSingle(),
    )
    return result.kind === "ok" ? dbOk(result.value.display_name) : result
}
