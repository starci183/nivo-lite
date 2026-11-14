"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR, { type SWRConfiguration } from "swr"
import { queryAgentGraphLayout, type QueryAgentGraphLayoutRequest } from "@/modules/api/graphql/queries/query-agent-graph-layout"
import type { AgentGraphLayoutQuery } from "@/modules/api"

/** The SWR key of {@link useQueryAgentGraphLayoutSwr}. */
export const QUERY_AGENT_GRAPH_LAYOUT_SWR_KEY = "QUERY_AGENT_GRAPH_LAYOUT_SWR"

/** The back end `agentGraphLayout` query: the saved layout of the Graph page of one installation. Pass `null` to wait for the installation. */
export const useQueryAgentGraphLayoutSwr = (
    installationId: string | null,
    config?: SWRConfiguration,
): ReadResponse<AgentGraphLayoutQuery["agentGraphLayout"]> => {
    const request: QueryAgentGraphLayoutRequest | null = installationId === null ? null : { installationId }
    return useSWR(
        useWorkspaceRequestKey(QUERY_AGENT_GRAPH_LAYOUT_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentGraphLayoutRequest>) =>
            answeredData(await queryAgentGraphLayout({ request: input }), QUERY_AGENT_GRAPH_LAYOUT_SWR_KEY).agentGraphLayout,
        config,
    )
}
