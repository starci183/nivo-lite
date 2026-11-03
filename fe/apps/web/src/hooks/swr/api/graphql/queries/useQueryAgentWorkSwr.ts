"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryAgentWork, type QueryAgentWorkRequest } from "@/modules/api/graphql/queries/query-agent-work"
import type { AgentWorkQuery } from "@/modules/api"

/** The SWR key of {@link useQueryAgentWorkSwr}. */
export const QUERY_AGENT_WORK_SWR_KEY = "QUERY_AGENT_WORK_SWR"

/** The back end `agentWork` query. Pass `null` to wait for the arguments. */
export const useQueryAgentWorkSwr = (
    request: QueryAgentWorkRequest | null,
    config?: SWRConfiguration,
): ReadResponse<AgentWorkQuery["agentWork"]> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_AGENT_WORK_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentWorkRequest>) =>
            answeredData(await queryAgentWork({ request: input }), QUERY_AGENT_WORK_SWR_KEY).agentWork,
        config,
    )
