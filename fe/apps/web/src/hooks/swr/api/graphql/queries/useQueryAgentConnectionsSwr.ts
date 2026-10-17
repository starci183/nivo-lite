"use client"

import { answeredData } from "@/hooks/workspaceread"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryAgentConnections } from "@/modules/api/graphql/queries/query-agent-connections"
import type { QueryAgentConnectionsRequest } from "@/modules/api/graphql/queries/query-agent-connections"

/** The SWR key of {@link useQueryAgentConnectionsSwr}. */
export const QUERY_AGENT_CONNECTIONS_SWR_KEY = "QUERY_AGENT_CONNECTIONS_SWR"

/** The back end `agentConnections` query. Pass `null` to wait for the arguments. */
export const useQueryAgentConnectionsSwr = (request: QueryAgentConnectionsRequest | null, config?: SWRConfiguration) =>
    useSWR(
        useWorkspaceRequestKey(QUERY_AGENT_CONNECTIONS_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentConnectionsRequest>) =>
            answeredData(await queryAgentConnections({ request: input }), QUERY_AGENT_CONNECTIONS_SWR_KEY)
                .agentConnections,
        config,
    )
