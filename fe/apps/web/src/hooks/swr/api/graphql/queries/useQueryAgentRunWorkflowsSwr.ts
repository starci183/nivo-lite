"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryAgentRunWorkflows, type QueryAgentRunWorkflowsRequest } from "@/modules/api/graphql/queries/query-agent-run-workflows"
import type { AgentRunWorkflowsQuery } from "@/modules/api"

/** The SWR key of {@link useQueryAgentRunWorkflowsSwr}. */
export const QUERY_AGENT_RUN_WORKFLOWS_SWR_KEY = "QUERY_AGENT_RUN_WORKFLOWS_SWR"

/** The back end `agentRunWorkflows` query. Pass `null` to wait for the arguments. */
export const useQueryAgentRunWorkflowsSwr = (
    request: QueryAgentRunWorkflowsRequest | null,
    config?: SWRConfiguration,
): ReadResponse<AgentRunWorkflowsQuery["agentRunWorkflows"]> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_AGENT_RUN_WORKFLOWS_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentRunWorkflowsRequest>) =>
            answeredData(await queryAgentRunWorkflows({ request: input }), QUERY_AGENT_RUN_WORKFLOWS_SWR_KEY).agentRunWorkflows,
        config,
    )
