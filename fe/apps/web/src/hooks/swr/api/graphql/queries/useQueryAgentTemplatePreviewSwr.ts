"use client"

import { answeredData, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration, SWRResponse } from "swr"
import type { AgentTemplatePreviewQuery } from "@/modules/api"
import {
    queryAgentTemplatePreview,
    type QueryAgentTemplatePreviewRequest,
} from "@/modules/api/graphql/queries/query-agent-template-preview"

/** The SWR key of {@link useQueryAgentTemplatePreviewSwr}. */
export const QUERY_AGENT_TEMPLATE_PREVIEW_SWR_KEY = "QUERY_AGENT_TEMPLATE_PREVIEW_SWR"

/** The back end `agentTemplatePreview` query. Pass `null` to wait for the arguments. */
export const useQueryAgentTemplatePreviewSwr = (
    request: QueryAgentTemplatePreviewRequest | null,
    config?: SWRConfiguration,
): SWRResponse<AgentTemplatePreviewQuery["agentTemplatePreview"], Error> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_AGENT_TEMPLATE_PREVIEW_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentTemplatePreviewRequest>) =>
            answeredData(await queryAgentTemplatePreview({ request: input }), QUERY_AGENT_TEMPLATE_PREVIEW_SWR_KEY)
                .agentTemplatePreview,
        config,
    )
