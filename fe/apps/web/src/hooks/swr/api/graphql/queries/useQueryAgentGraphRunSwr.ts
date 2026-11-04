"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryAgentGraphRun, type QueryAgentGraphRunRequest } from "@/modules/api/graphql/queries/query-agent-graph-run"
import type { AgentGraphRunQuery } from "@/modules/api"

/** The SWR key of {@link useQueryAgentGraphRunSwr}. */
export const QUERY_AGENT_GRAPH_RUN_SWR_KEY = "QUERY_AGENT_GRAPH_RUN_SWR"

/** The back end `agentGraphRun` query. Pass `null` to wait for the arguments. */
export const useQueryAgentGraphRunSwr = (
    request: QueryAgentGraphRunRequest | null,
    config?: SWRConfiguration,
): ReadResponse<AgentGraphRunQuery["agentGraphRun"]> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_AGENT_GRAPH_RUN_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentGraphRunRequest>) =>
            answeredData(await queryAgentGraphRun({ request: input }), QUERY_AGENT_GRAPH_RUN_SWR_KEY).agentGraphRun,
        config,
    )
