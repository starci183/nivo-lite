"use client"

import { answeredData } from "@/hooks/workspaceread"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryAgentGraphCoverage } from "@/modules/api/graphql/queries/query-agent-graph-coverage"
import type { QueryAgentGraphCoverageRequest } from "@/modules/api/graphql/queries/query-agent-graph-coverage"

/** The SWR key of {@link useQueryAgentGraphCoverageSwr}. */
export const QUERY_AGENT_GRAPH_COVERAGE_SWR_KEY = "QUERY_AGENT_GRAPH_COVERAGE_SWR"

/** The back end `agentGraphCoverage` query. Pass `null` to wait for the arguments. */
export const useQueryAgentGraphCoverageSwr = (
    request: QueryAgentGraphCoverageRequest | null,
    config?: SWRConfiguration,
) =>
    useSWR(
        useWorkspaceRequestKey(QUERY_AGENT_GRAPH_COVERAGE_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentGraphCoverageRequest>) =>
            answeredData(await queryAgentGraphCoverage({ request: input }), QUERY_AGENT_GRAPH_COVERAGE_SWR_KEY)
                .agentGraphCoverage,
        config,
    )
