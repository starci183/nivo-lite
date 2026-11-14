"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { answeredData, type ReadResponse } from "@/hooks/workspaceread"
import { queryAgentTemplateNodeRequests } from "@/modules/api/graphql/queries/query-agent-template-node-requests"
import type { AgentTemplateNodeRequestsQuery } from "@/modules/api"

/** The SWR key of what one workflow template asks for on accounts. */
export const QUERY_AGENT_TEMPLATE_NODE_REQUESTS_SWR_KEY = "QUERY_AGENT_TEMPLATE_NODE_REQUESTS_SWR"

/** What one workflow template's steps ask for before install (the back end `agentTemplateNodeRequests`). `null` reads nothing. */
export const useQueryAgentTemplateNodeRequestsSwr = (
    templateId: string | null,
): ReadResponse<AgentTemplateNodeRequestsQuery["agentTemplateNodeRequests"]> =>
    useSWR(
        useWorkspaceKey(QUERY_AGENT_TEMPLATE_NODE_REQUESTS_SWR_KEY, [templateId], templateId !== null && templateId !== ""),
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            answeredData(
                await queryAgentTemplateNodeRequests({ request: { templateId: templateId ?? "" }, signal }),
                "agentTemplateNodeRequests",
            ).agentTemplateNodeRequests,
        { errorRetryCount: 1, revalidateOnFocus: false },
    )
