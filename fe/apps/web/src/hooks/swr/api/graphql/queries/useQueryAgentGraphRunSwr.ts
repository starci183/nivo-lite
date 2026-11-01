"use client"

import { answeredData } from "@/hooks/workspaceread"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryAgentGraphRun } from "@/modules/api/graphql/queries/query-agent-graph-run"
import type { QueryAgentGraphRunRequest } from "@/modules/api/graphql/queries/query-agent-graph-run"

/** The SWR key of {@link useQueryAgentGraphRunSwr}. */
export const QUERY_AGENT_GRAPH_RUN_SWR_KEY = "QUERY_AGENT_GRAPH_RUN_SWR"

/** The back end `agentGraphRun` query. Pass `null` to wait for the arguments. */
export const useQueryAgentGraphRunSwr = (request: QueryAgentGraphRunRequest | null, config?: SWRConfiguration) =>
    useSWR(
        useWorkspaceRequestKey(QUERY_AGENT_GRAPH_RUN_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentGraphRunRequest>) =>
            answeredData(await queryAgentGraphRun({ request: input }), QUERY_AGENT_GRAPH_RUN_SWR_KEY).agentGraphRun,
        config,
    )
