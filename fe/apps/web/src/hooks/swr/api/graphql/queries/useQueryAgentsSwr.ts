"use client"

import { answeredData } from "@/hooks/workspaceread"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryAgents } from "@/modules/api/graphql/queries/query-agents"
import type { QueryAgentsRequest } from "@/modules/api/graphql/queries/query-agents"

/** The SWR key of {@link useQueryAgentsSwr}. */
export const QUERY_AGENTS_SWR_KEY = "QUERY_AGENTS_SWR"

/** The back end `agents` query. Pass `null` to wait for the arguments. */
export const useQueryAgentsSwr = (request: QueryAgentsRequest | null, config?: SWRConfiguration) =>
    useSWR(
        useWorkspaceRequestKey(QUERY_AGENTS_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentsRequest>) =>
            answeredData(await queryAgents({ request: input }), QUERY_AGENTS_SWR_KEY).agents,
        config,
    )
