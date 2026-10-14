"use client"

import type { SWRConfiguration } from "swr"
import { useGraphqlQuerySwr } from "@/hooks/reuseables"
import { queryAgentConnections } from "@/modules/api/graphql/queries/query-agent-connections"
import type { QueryAgentConnectionsRequest } from "@/modules/api/graphql/queries/query-agent-connections"

/** The SWR key of {@link useQueryAgentConnectionsSwr}. */
export const QUERY_AGENT_CONNECTIONS_SWR_KEY = "QUERY_AGENT_CONNECTIONS_SWR"

/** The back end `agentConnections` query. Pass `null` to wait for the arguments. */
export const useQueryAgentConnectionsSwr = (request: QueryAgentConnectionsRequest | null, config?: SWRConfiguration) =>
    useGraphqlQuerySwr(
        QUERY_AGENT_CONNECTIONS_SWR_KEY,
        request,
        (input) => queryAgentConnections({ request: input }),
        (data) => data.agentConnections,
        config,
    )
