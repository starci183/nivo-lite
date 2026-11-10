"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryAgentWorkLog, type QueryAgentWorkLogRequest } from "@/modules/api/graphql/queries/query-agent-work-log"
import type { AgentWorkLogQuery } from "@/modules/api"

/** The SWR key of {@link useQueryAgentWorkLogSwr}. */
export const QUERY_AGENT_WORK_LOG_SWR_KEY = "QUERY_AGENT_WORK_LOG_SWR"

/** The back end `agentWorkLog` query. Pass `null` to wait for the arguments. */
export const useQueryAgentWorkLogSwr = (
    request: QueryAgentWorkLogRequest | null,
    config?: SWRConfiguration,
): ReadResponse<AgentWorkLogQuery["agentWorkLog"]> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_AGENT_WORK_LOG_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentWorkLogRequest>) =>
            answeredData(await queryAgentWorkLog({ request: input }), QUERY_AGENT_WORK_LOG_SWR_KEY).agentWorkLog,
        config,
    )
