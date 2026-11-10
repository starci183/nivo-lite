"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryAgentWorkflows, type QueryAgentWorkflowsRequest } from "@/modules/api/graphql/queries/query-agent-workflows"
import type { AgentWorkflowsQuery } from "@/modules/api"

/** The SWR key of {@link useQueryAgentWorkflowsSwr}. */
export const QUERY_AGENT_WORKFLOWS_SWR_KEY = "QUERY_AGENT_WORKFLOWS_SWR"

/** The back end `agentWorkflows` query. Pass `null` to wait for the arguments. */
export const useQueryAgentWorkflowsSwr = (
    request: QueryAgentWorkflowsRequest | null,
    config?: SWRConfiguration,
): ReadResponse<AgentWorkflowsQuery["agentWorkflows"]> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_AGENT_WORKFLOWS_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentWorkflowsRequest>) =>
            answeredData(await queryAgentWorkflows({ request: input }), QUERY_AGENT_WORKFLOWS_SWR_KEY).agentWorkflows,
        config,
    )
