import "server-only"

import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import type { IdeaDecision } from "@/modules/types"

const STATES_LIMIT = 200

/** What the workspace decided about its knowledge suggestions, and its business type (which suggestions fit). */
export interface SuggestionContext {
    readonly states: ReadonlyMap<string, IdeaDecision>
    readonly businessType: string | null
}

/** Reads the decisions on the suggestions and the business type of a workspace, under the caller's row level security. */
export const readSuggestionContext = async (workspaceId: string): Promise<DbOutcome<SuggestionContext>> => {
    const client = await createServerDbClient()
    const [states, workspace] = await Promise.all([
        client
            .from("knowledge_suggestion_state")
            .select("suggestion_key, state")
            .eq("workspace_id", workspaceId)
            .limit(STATES_LIMIT),
        client.from("workspaces").select("business_type").eq("id", workspaceId).limit(1),
    ])
    const rows = toOutcome(states)
    if (rows.kind !== "ok") return rows
    const kinds = toOutcome(workspace)
    if (kinds.kind !== "ok") return kinds
    const decided = new Map<string, IdeaDecision>()
    for (const row of rows.value) {
        if (row.state === "dismissed" || row.state === "not_applicable") decided.set(row.suggestion_key, row.state)
    }
    return dbOk({ states: decided, businessType: kinds.value[0]?.business_type ?? null })
}
