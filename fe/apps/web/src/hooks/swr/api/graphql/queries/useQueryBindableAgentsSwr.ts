"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR, { type SWRConfiguration } from "swr"
import { queryBindableAgents, type QueryBindableAgentsRequest } from "@/modules/api/graphql/queries/query-bindable-agents"
import type { BindableAgentsQuery } from "@/modules/api"

/** The SWR key of {@link useQueryBindableAgentsSwr}. */
export const QUERY_BINDABLE_AGENTS_SWR_KEY = "QUERY_BINDABLE_AGENTS_SWR"

/** The back end `bindableAgents` query: who may be bound to a connection of one provider. Pass `null` to wait for the provider. */
export const useQueryBindableAgentsSwr = (
    request: QueryBindableAgentsRequest | null,
    config?: SWRConfiguration,
): ReadResponse<BindableAgentsQuery["bindableAgents"]> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_BINDABLE_AGENTS_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryBindableAgentsRequest>) =>
            answeredData(await queryBindableAgents({ request: input }), QUERY_BINDABLE_AGENTS_SWR_KEY).bindableAgents,
        config,
    )
