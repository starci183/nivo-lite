"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryAgentWorkflowGraph, type QueryAgentWorkflowGraphRequest } from "@/modules/api/graphql/queries/query-agent-workflow-graph"
import type { AgentWorkflowGraphQuery } from "@/modules/api"

/** The SWR key of {@link useQueryAgentWorkflowGraphSwr}. */
export const QUERY_AGENT_WORKFLOW_GRAPH_SWR_KEY = "QUERY_AGENT_WORKFLOW_GRAPH_SWR"

/** The back end `agentWorkflowGraph` query: the agent Graph page of one installation. Pass `null` to wait for the installation. */
export const useQueryAgentWorkflowGraphSwr = (
    installationId: string | null,
    config?: SWRConfiguration,
): ReadResponse<AgentWorkflowGraphQuery["agentWorkflowGraph"]> => {
    const request: QueryAgentWorkflowGraphRequest | null = installationId === null ? null : { installationId }
    return useSWR(
        useWorkspaceRequestKey(QUERY_AGENT_WORKFLOW_GRAPH_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentWorkflowGraphRequest>) =>
            answeredData(await queryAgentWorkflowGraph({ request: input }), QUERY_AGENT_WORKFLOW_GRAPH_SWR_KEY).agentWorkflowGraph,
        config,
    )
}
