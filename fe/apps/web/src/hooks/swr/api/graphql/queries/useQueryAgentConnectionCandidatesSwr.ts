"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import {
    queryAgentConnectionCandidates,
    type QueryAgentConnectionCandidatesRequest,
} from "@/modules/api/graphql/queries/query-agent-connection-candidates"
import type { AgentConnectionCandidatesQuery } from "@/modules/api"

/** The SWR key of {@link useQueryAgentConnectionCandidatesSwr}. */
export const QUERY_AGENT_CONNECTION_CANDIDATES_SWR_KEY = "QUERY_AGENT_CONNECTION_CANDIDATES_SWR"

/** The back end `agentConnectionCandidates` query. Pass `null` to wait for the arguments. */
export const useQueryAgentConnectionCandidatesSwr = (
    request: QueryAgentConnectionCandidatesRequest | null,
    config?: SWRConfiguration,
): ReadResponse<AgentConnectionCandidatesQuery["agentConnectionCandidates"]> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_AGENT_CONNECTION_CANDIDATES_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentConnectionCandidatesRequest>) =>
            answeredData(
                await queryAgentConnectionCandidates({ request: input }),
                QUERY_AGENT_CONNECTION_CANDIDATES_SWR_KEY,
            ).agentConnectionCandidates,
        config,
    )
