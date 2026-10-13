import { queryAgentDashboard } from "@/modules/api/graphql/queries/query-agent-dashboard"
import type { QueryAgentDashboardRequest } from "@/modules/api/graphql/queries/query-agent-dashboard"
import { useWorkspaceQuerySwr } from "@/hooks/reuseables/useWorkspaceQuerySwr"

/** The SWR key of the agentDashboard query. */
export const QUERY_AGENT_DASHBOARD_SWR_KEY = "QUERY_AGENT_DASHBOARD_SWR"

/** One agent dashboard of the workspace. */
export const useQueryAgentDashboardSwr = (request: QueryAgentDashboardRequest) =>
    useWorkspaceQuerySwr(
        QUERY_AGENT_DASHBOARD_SWR_KEY,
        [request.module, request.installationId ?? null],
        () => queryAgentDashboard({ request }),
        (data) => data.agentDashboard,
    )
