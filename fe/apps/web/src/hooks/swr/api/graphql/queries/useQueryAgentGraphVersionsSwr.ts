"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR, { type SWRConfiguration } from "swr"
import {
    queryAgentGraphVersions,
    type QueryAgentGraphVersionsRequest,
} from "@/modules/api/graphql/queries/query-agent-graph-versions"
import type { AgentGraphVersionsQuery } from "@/modules/api"

/** The SWR key of {@link useQueryAgentGraphVersionsSwr}. */
export const QUERY_AGENT_GRAPH_VERSIONS_SWR_KEY = "QUERY_AGENT_GRAPH_VERSIONS_SWR"

/** The back end `agentGraphVersions` query. Pass `null` to wait for the arguments. */
export const useQueryAgentGraphVersionsSwr = (
    request: QueryAgentGraphVersionsRequest | null,
    config?: SWRConfiguration,
): ReadResponse<AgentGraphVersionsQuery["listAgentGraphVersions"]> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_AGENT_GRAPH_VERSIONS_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentGraphVersionsRequest>) =>
            answeredData(await queryAgentGraphVersions({ request: input }), QUERY_AGENT_GRAPH_VERSIONS_SWR_KEY)
                .listAgentGraphVersions,
        config,
    )
