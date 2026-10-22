"use client"

import { answeredData } from "@/hooks/workspaceread"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryAgentPage } from "@/modules/api/graphql/queries/query-agent-page"
import type { QueryAgentPageRequest } from "@/modules/api/graphql/queries/query-agent-page"

/** The SWR key of {@link useQueryAgentPageSwr}. */
export const QUERY_AGENT_PAGE_SWR_KEY = "QUERY_AGENT_PAGE_SWR"

/** The back end `agentPage` query. Pass `null` to wait for the arguments. */
export const useQueryAgentPageSwr = (request: QueryAgentPageRequest | null, config?: SWRConfiguration) =>
    useSWR(
        useWorkspaceRequestKey(QUERY_AGENT_PAGE_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentPageRequest>) =>
            answeredData(await queryAgentPage({ request: input }), QUERY_AGENT_PAGE_SWR_KEY).agentPage,
        config,
    )
