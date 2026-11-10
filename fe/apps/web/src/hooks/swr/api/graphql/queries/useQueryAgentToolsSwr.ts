"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryAgentTools } from "@/modules/api/graphql/queries/query-agent-tools"
import { answeredData, type ReadResponse } from "@/hooks/workspaceread"
import type { AgentToolsQuery } from "@/modules/api"

/** The SWR key of the agentTools query. */
export const QUERY_AGENT_TOOLS_SWR_KEY = "QUERY_AGENT_TOOLS_SWR"

/**
 * The tools one agent may call. Pass `null` to wait for the agent. A failed read is not retried: a back end without the query, or a
 * person who is not owner or manager, answers the same failure again; the rights tab then leaves the block out.
 */
export const useQueryAgentToolsSwr = (agentId: string | null): ReadResponse<AgentToolsQuery["agentTools"]> =>
    useSWR(
        useWorkspaceKey(QUERY_AGENT_TOOLS_SWR_KEY, [agentId], agentId !== null && agentId !== ""),
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            answeredData(await queryAgentTools({ request: { agentId: agentId ?? "" }, signal }), QUERY_AGENT_TOOLS_SWR_KEY)
                .agentTools,
        { shouldRetryOnError: false },
    )
