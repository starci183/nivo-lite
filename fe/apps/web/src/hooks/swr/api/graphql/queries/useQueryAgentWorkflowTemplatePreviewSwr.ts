"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR, { type SWRConfiguration } from "swr"
import { queryAgentWorkflowTemplatePreview, type QueryAgentWorkflowTemplatePreviewRequest } from "@/modules/api/graphql/queries/query-agent-workflow-template-preview"
import type { AgentWorkflowTemplatePreviewQuery } from "@/modules/api"

/** The SWR key of {@link useQueryAgentWorkflowTemplatePreviewSwr}. */
export const QUERY_AGENT_WORKFLOW_TEMPLATE_PREVIEW_SWR_KEY = "QUERY_AGENT_WORKFLOW_TEMPLATE_PREVIEW_SWR"

/** The back end `agentWorkflowTemplatePreview` query. Pass `null` to wait for the arguments. */
export const useQueryAgentWorkflowTemplatePreviewSwr = (
    request: QueryAgentWorkflowTemplatePreviewRequest | null,
    config?: SWRConfiguration,
): ReadResponse<AgentWorkflowTemplatePreviewQuery["agentWorkflowTemplatePreview"]> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_AGENT_WORKFLOW_TEMPLATE_PREVIEW_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentWorkflowTemplatePreviewRequest>) =>
            answeredData(await queryAgentWorkflowTemplatePreview({ request: input }), QUERY_AGENT_WORKFLOW_TEMPLATE_PREVIEW_SWR_KEY).agentWorkflowTemplatePreview,
        config,
    )
