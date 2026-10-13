"use server"
import "server-only"

import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { suggestionSchema } from "./knowledge.mapper"

/** Marks a knowledge suggestion not applicable or dismissed; a null state brings it back. Row level security admits managers only. */
export const writeSuggestionState = async (input: unknown): Promise<DbOutcome<null>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = suggestionSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "suggestion-input")
    const client = await createServerDbClient()
    const { workspaceId, key, state } = parsed.data
    if (state === null) {
        const removed = await client
            .from("knowledge_suggestion_state")
            .delete()
            .eq("workspace_id", workspaceId)
            .eq("suggestion_key", key)
            .select("suggestion_key")
        if (removed.error !== null) return dbFailure("unavailable", removed.error.code)
        return removed.data.length === 0 ? dbFailure("refused", "not-a-manager") : dbOk(null)
    }
    const saved = toOutcome(
        await client
            .from("knowledge_suggestion_state")
            .upsert({
                workspace_id: workspaceId,
                suggestion_key: key,
                state,
                decided_by: principal.value.id,
                decided_at: new Date().toISOString(),
            })
            .select("suggestion_key")
            .single(),
    )
    return saved.kind === "ok" ? dbOk(null) : saved
}
