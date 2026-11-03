"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryAgents, type QueryAgentsRequest } from "@/modules/api/graphql/queries/query-agents"
import type { AgentsQuery } from "@/modules/api"

/** The SWR key of {@link useQueryAgentsSwr}. */
export const QUERY_AGENTS_SWR_KEY = "QUERY_AGENTS_SWR"

/** The back end `agents` query. Pass `null` to wait for the arguments. */
export const useQueryAgentsSwr = (
    request: QueryAgentsRequest | null,
    config?: SWRConfiguration,
): ReadResponse<AgentsQuery["agents"]> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_AGENTS_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentsRequest>) =>
            answeredData(await queryAgents({ request: input }), QUERY_AGENTS_SWR_KEY).agents,
        config,
    )
