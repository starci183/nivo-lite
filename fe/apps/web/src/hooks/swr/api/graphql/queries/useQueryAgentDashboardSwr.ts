"use client"

import { workspaceArgumentKey, noData } from "@/hooks/workspaceread"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import { queryAgentDashboard } from "@/modules/api/graphql/queries/query-agent-dashboard"
import type { QueryAgentDashboardRequest } from "@/modules/api/graphql/queries/query-agent-dashboard"

/** Workspace-scoped cache identity for the agentDashboard query. */
export const QUERY_AGENT_DASHBOARD_SWR_KEY = "QUERY_AGENT_DASHBOARD_SWR"

/** Reads agentDashboard. The workspace id is part of the cache identity; `undefined` pauses the read. */
export const useQueryAgentDashboardSwr = (workspaceId: string | undefined, request: QueryAgentDashboardRequest) =>
    useSWR(
        workspaceArgumentKey(QUERY_AGENT_DASHBOARD_SWR_KEY, workspaceId, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentDashboardRequest>) =>
            (await queryAgentDashboard({ request: input })).data?.agentDashboard ?? noData("agentDashboard"),
    )
