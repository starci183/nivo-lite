"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryAgentWorkflow, type QueryAgentWorkflowRequest } from "@/modules/api/graphql/queries/query-agent-workflow"
import type { AgentWorkflowQuery } from "@/modules/api"

/** The SWR key of {@link useQueryAgentWorkflowSwr}. */
export const QUERY_AGENT_WORKFLOW_SWR_KEY = "QUERY_AGENT_WORKFLOW_SWR"

/** The back end `agentWorkflow` query. Pass `null` to wait for the arguments. */
export const useQueryAgentWorkflowSwr = (
    request: QueryAgentWorkflowRequest | null,
    config?: SWRConfiguration,
): ReadResponse<AgentWorkflowQuery["agentWorkflow"]> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_AGENT_WORKFLOW_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentWorkflowRequest>) =>
            answeredData(await queryAgentWorkflow({ request: input }), QUERY_AGENT_WORKFLOW_SWR_KEY).agentWorkflow,
        config,
    )
