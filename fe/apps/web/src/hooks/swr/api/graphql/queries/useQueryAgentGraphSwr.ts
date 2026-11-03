"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryAgentGraph, type QueryAgentGraphRequest } from "@/modules/api/graphql/queries/query-agent-graph"
import type { AgentGraphQuery } from "@/modules/api"

/** The SWR key of {@link useQueryAgentGraphSwr}. */
export const QUERY_AGENT_GRAPH_SWR_KEY = "QUERY_AGENT_GRAPH_SWR"

/** The back end `getAgentGraph` query. Pass `null` to wait for the arguments. */
export const useQueryAgentGraphSwr = (
    request: QueryAgentGraphRequest | null,
    config?: SWRConfiguration,
): ReadResponse<AgentGraphQuery["getAgentGraph"]> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_AGENT_GRAPH_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentGraphRequest>) =>
            answeredData(await queryAgentGraph({ request: input }), QUERY_AGENT_GRAPH_SWR_KEY).getAgentGraph,
        config,
    )
