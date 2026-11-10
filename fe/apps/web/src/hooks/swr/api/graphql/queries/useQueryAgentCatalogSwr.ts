"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryAgentCatalog } from "@/modules/api/graphql/queries/query-agent-catalog"
import type { ReadResponse } from "@/hooks/workspaceread"
import type { AgentCatalogQuery } from "@/modules/api"

/** The SWR key of the agent catalogue. */
export const QUERY_AGENT_CATALOG_SWR_KEY = "QUERY_AGENT_CATALOG_SWR"

/** Every agent of the active workspace with its granted connections and knowledge counts (the back end `agentCatalog` query). */
export const useQueryAgentCatalogSwr = (): ReadResponse<AgentCatalogQuery["agentCatalog"]> =>
    useSWR(
        useWorkspaceKey(QUERY_AGENT_CATALOG_SWR_KEY, []),
        async ({ signal }: { signal?: AbortSignal } = {}) => {
            const result = await queryAgentCatalog({ signal })
            if (!result.data) throw new Error("agentCatalog answered no data")
            return result.data.agentCatalog
        },
    )
