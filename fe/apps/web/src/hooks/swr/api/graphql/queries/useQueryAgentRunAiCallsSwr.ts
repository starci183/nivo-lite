"use client"

import useSWR from "swr"
import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import {
    queryAgentRunAiCalls,
    type QueryAgentRunAiCallsRequest,
} from "@/modules/api/graphql/queries/query-agent-run-ai-calls"
import type { AgentRunAiCallsQuery } from "@/modules/api"

/** The SWR key of {@link useQueryAgentRunAiCallsSwr}. */
export const QUERY_AGENT_RUN_AI_CALLS_SWR_KEY = "QUERY_AGENT_RUN_AI_CALLS_SWR"

/** The AI calls of one run (its own read beside the page's `agentRun`). Pass `null` to wait for the arguments. A failed read is not retried. */
export const useQueryAgentRunAiCallsSwr = (
    request: QueryAgentRunAiCallsRequest | null,
): ReadResponse<NonNullable<AgentRunAiCallsQuery["agentRun"]>["aiCalls"]> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_AGENT_RUN_AI_CALLS_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentRunAiCallsRequest>) =>
            answeredData(await queryAgentRunAiCalls({ request: input }), QUERY_AGENT_RUN_AI_CALLS_SWR_KEY).agentRun
                ?.aiCalls ?? [],
        { shouldRetryOnError: false },
    )
