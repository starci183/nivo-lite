"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryAgentRun, type QueryAgentRunRequest } from "@/modules/api/graphql/queries/query-agent-run"
import type { AgentRunQuery } from "@/modules/api"

/** The SWR key of {@link useQueryAgentRunSwr}. */
export const QUERY_AGENT_RUN_SWR_KEY = "QUERY_AGENT_RUN_SWR"

/** The back end `agentRun` query. Pass `null` to wait for the arguments. */
export const useQueryAgentRunSwr = (
    request: QueryAgentRunRequest | null,
    config?: SWRConfiguration,
): ReadResponse<AgentRunQuery["agentRun"]> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_AGENT_RUN_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentRunRequest>) =>
            answeredData(await queryAgentRun({ request: input }), QUERY_AGENT_RUN_SWR_KEY).agentRun,
        config,
    )
