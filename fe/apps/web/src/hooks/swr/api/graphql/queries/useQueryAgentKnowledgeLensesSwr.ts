"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryAgentKnowledgeLenses } from "@/modules/api/graphql/queries/query-agent-knowledge-lenses"

/** The SWR key of the views of the shared knowledge. */
export const QUERY_AGENT_KNOWLEDGE_LENSES_SWR_KEY = "QUERY_AGENT_KNOWLEDGE_LENSES_SWR"

/** What the customer and every active agent of the active workspace may read of the shared knowledge (the back end `agentKnowledgeLenses` query). */
export const useQueryAgentKnowledgeLensesSwr = () =>
    useSWR(
        useWorkspaceKey(QUERY_AGENT_KNOWLEDGE_LENSES_SWR_KEY, []),
        async ({ signal }: { signal?: AbortSignal } = {}) => {
            const result = await queryAgentKnowledgeLenses({ signal })
            if (!result.data) throw new Error("agentKnowledgeLenses answered no data")
            return result.data.agentKnowledgeLenses
        },
    )
