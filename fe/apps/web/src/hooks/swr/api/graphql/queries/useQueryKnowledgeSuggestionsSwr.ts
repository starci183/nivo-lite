"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryKnowledgeSuggestions } from "@/modules/api/graphql/queries/query-knowledge-suggestions"

/** The SWR key of the suggestions read; `setKnowledgeSuggestionState` revalidates the keys that lead with it. */
export const QUERY_KNOWLEDGE_SUGGESTIONS_SWR_KEY = "QUERY_KNOWLEDGE_SUGGESTIONS_SWR"

/**
 * The suggestion context of the active workspace: its business type and the decisions the owner took (the back end
 * `knowledgeSuggestions` query). Managers only; callers pass `enabled` false for other members.
 */
export const useQueryKnowledgeSuggestionsSwr = (enabled: boolean) => {
    const key = useWorkspaceKey(QUERY_KNOWLEDGE_SUGGESTIONS_SWR_KEY, [], enabled)
    return useSWR(key, async ({ signal }: { signal?: AbortSignal } = {}) => {
        const result = await queryKnowledgeSuggestions({ signal })
        if (!result.data) throw new Error("knowledgeSuggestions answered no data")
        return result.data.knowledgeSuggestions
    })
}
