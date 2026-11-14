"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR, { type SWRConfiguration } from "swr"
import { queryAgentRuns, type QueryAgentRunsRequest } from "@/modules/api/graphql/queries/query-agent-runs"
import type { AgentRunsQuery } from "@/modules/api"

/** The SWR key of {@link useQueryAgentRunsSwr}. */
export const QUERY_AGENT_RUNS_SWR_KEY = "QUERY_AGENT_RUNS_SWR"

/** The back end `agentRuns` query. Pass `null` to wait for the arguments. */
export const useQueryAgentRunsSwr = (
    request: QueryAgentRunsRequest | null,
    config?: SWRConfiguration,
): ReadResponse<AgentRunsQuery["agentRuns"]> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_AGENT_RUNS_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentRunsRequest>) =>
            answeredData(await queryAgentRuns({ request: input }), QUERY_AGENT_RUNS_SWR_KEY).agentRuns,
        config,
    )
