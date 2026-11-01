"use client"

import { answeredData } from "@/hooks/workspaceread"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryAgentGraphVersions } from "@/modules/api/graphql/queries/query-agent-graph-versions"
import type { QueryAgentGraphVersionsRequest } from "@/modules/api/graphql/queries/query-agent-graph-versions"

/** The SWR key of {@link useQueryAgentGraphVersionsSwr}. */
export const QUERY_AGENT_GRAPH_VERSIONS_SWR_KEY = "QUERY_AGENT_GRAPH_VERSIONS_SWR"

/** The back end `agentGraphVersions` query. Pass `null` to wait for the arguments. */
export const useQueryAgentGraphVersionsSwr = (
    request: QueryAgentGraphVersionsRequest | null,
    config?: SWRConfiguration,
) =>
    useSWR(
        useWorkspaceRequestKey(QUERY_AGENT_GRAPH_VERSIONS_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentGraphVersionsRequest>) =>
            answeredData(await queryAgentGraphVersions({ request: input }), QUERY_AGENT_GRAPH_VERSIONS_SWR_KEY)
                .listAgentGraphVersions,
        config,
    )
