import "server-only"

import { createServerDbClient } from "../server"
import { toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { dbOk } from "../outcome"

/** Whether the owner switched the drafting authority off (no rule at all means allowed: drafting never leaves the building). */
export const readDraftingBlocked = async (workspaceId: string): Promise<boolean> => {
    const client = await createServerDbClient()
    const rule = await client
        .from("authority_rules")
        .select("mode")
        .eq("workspace_id", workspaceId)
        .eq("action", "draft_post")
        .maybeSingle()
    return rule.data?.mode === "never"
}

/** Titles of the other recent posts, so a draft does not repeat them. */
export const readRecentTitles = async (
    workspaceId: string,
    exceptId: string,
): Promise<DbOutcome<ReadonlyArray<string>>> => {
    const client = await createServerDbClient()
    const rows = toOutcome(
        await client
            .from("content_items")
            .select("title")
            .eq("workspace_id", workspaceId)
            .neq("id", exceptId)
            .order("created_at", { ascending: false })
            .limit(8),
    )
    return rows.kind === "ok" ? dbOk(rows.value.map((r) => r.title)) : rows
}
