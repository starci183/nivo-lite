"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR, { type SWRConfiguration } from "swr"
import { queryAgentPage, type QueryAgentPageRequest } from "@/modules/api/graphql/queries/query-agent-page"
import type { AgentPageQuery } from "@/modules/api"

/** The SWR key of {@link useQueryAgentPageSwr}. */
export const QUERY_AGENT_PAGE_SWR_KEY = "QUERY_AGENT_PAGE_SWR"

/** The back end `agentPage` query. Pass `null` to wait for the arguments. */
export const useQueryAgentPageSwr = (
    request: QueryAgentPageRequest | null,
    config?: SWRConfiguration,
): ReadResponse<AgentPageQuery["agentPage"]> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_AGENT_PAGE_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentPageRequest>) =>
            answeredData(await queryAgentPage({ request: input }), QUERY_AGENT_PAGE_SWR_KEY).agentPage,
        config,
    )
