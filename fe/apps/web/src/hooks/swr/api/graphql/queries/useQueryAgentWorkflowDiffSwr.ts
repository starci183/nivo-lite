"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR, { type SWRConfiguration } from "swr"
import { queryAgentWorkflowDiff, type QueryAgentWorkflowDiffRequest } from "@/modules/api/graphql/queries/query-agent-workflow-diff"
import type { AgentWorkflowDiffQuery } from "@/modules/api"

/** The SWR key of {@link useQueryAgentWorkflowDiffSwr}. */
export const QUERY_AGENT_WORKFLOW_DIFF_SWR_KEY = "QUERY_AGENT_WORKFLOW_DIFF_SWR"

/** The back end `agentWorkflowDiff` query. Pass `null` to wait for the arguments. */
export const useQueryAgentWorkflowDiffSwr = (
    request: QueryAgentWorkflowDiffRequest | null,
    config?: SWRConfiguration,
): ReadResponse<AgentWorkflowDiffQuery["agentWorkflowDiff"]> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_AGENT_WORKFLOW_DIFF_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentWorkflowDiffRequest>) =>
            answeredData(await queryAgentWorkflowDiff({ request: input }), QUERY_AGENT_WORKFLOW_DIFF_SWR_KEY).agentWorkflowDiff,
        config,
    )
