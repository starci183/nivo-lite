import type { SWRConfiguration } from "swr"
import { useGraphqlQuerySwr } from "@/hooks/reuseables/useGraphqlQuerySwr"
import { queryAgentDashboard } from "@/modules/api/graphql/queries/query-agent-dashboard"
import type { QueryAgentDashboardRequest } from "@/modules/api/graphql/queries/query-agent-dashboard"

/** The SWR key of {@link useQueryAgentDashboardSwr}. */
export const QUERY_AGENT_DASHBOARD_SWR_KEY = "QUERY_AGENT_DASHBOARD_SWR"

/** The back end `agentDashboard` query. Pass `null` to wait for the arguments. */
export const useQueryAgentDashboardSwr = (request: QueryAgentDashboardRequest | null, config?: SWRConfiguration) =>
    useGraphqlQuerySwr(
        QUERY_AGENT_DASHBOARD_SWR_KEY,
        request,
        (input) => queryAgentDashboard({ request: input }),
        (data) => data.agentDashboard,
        config,
    )
