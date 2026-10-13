import { noData, useWorkspaceArgSwr } from "@/hooks/workspaceread"
import { queryAgentDashboard } from "@/modules/api/graphql/queries/query-agent-dashboard"
import type { QueryAgentDashboardRequest } from "@/modules/api/graphql/queries/query-agent-dashboard"

/** Workspace-scoped cache identity for the agentDashboard query. */
export const QUERY_AGENT_DASHBOARD_SWR_KEY = "QUERY_AGENT_DASHBOARD_SWR"

/** Reads agentDashboard. The workspace id is part of the cache identity; `undefined` pauses the read. */
export const useQueryAgentDashboardSwr = (workspaceId: string | undefined, request: QueryAgentDashboardRequest) =>
    useWorkspaceArgSwr(
        QUERY_AGENT_DASHBOARD_SWR_KEY,
        workspaceId,
        request,
        async (value) =>
            (await queryAgentDashboard({ request: value })).data?.agentDashboard ?? noData("agentDashboard"),
    )
