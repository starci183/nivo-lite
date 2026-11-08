"use client"

import { noData, workspaceArgumentKey, type WorkspaceReadKey } from "@/hooks/workspaceread"
import useSWR, { type SWRResponse } from "swr"
import {
    queryAgentDashboard,
    type QueryAgentDashboardRequest,
} from "@/modules/api/graphql/queries/query-agent-dashboard"
import type { AgentDashboardQuery } from "@/modules/api"

/** Workspace-scoped cache identity for the agentDashboard query. */
export const QUERY_AGENT_DASHBOARD_SWR_KEY = "QUERY_AGENT_DASHBOARD_SWR"

/** Reads agentDashboard. The workspace id is part of the cache identity; `undefined` pauses the read. */
export const useQueryAgentDashboardSwr = (
    workspaceId: string | undefined,
    request: QueryAgentDashboardRequest,
): SWRResponse<NonNullable<AgentDashboardQuery["agentDashboard"]>, Error> =>
    useSWR(
        workspaceArgumentKey(QUERY_AGENT_DASHBOARD_SWR_KEY, workspaceId, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentDashboardRequest>) =>
            (await queryAgentDashboard({ request: input })).data?.agentDashboard ?? noData("agentDashboard"),
    )
