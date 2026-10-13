import useSWR from "swr"
import type { ModuleKey } from "@/lib/modules-shared"
import { queryAgentDashboard } from "@/modules/api/graphql/queries/query-agent-dashboard"
import { agentDashboardOf } from "@/modules/utils"

/** Cache identity of the agent dashboard regions. */
export const QUERY_AGENT_DASHBOARD_SWR_KEY = "QUERY_AGENT_DASHBOARD_SWR"

/** Loads the independently fallible dashboard regions for one workspace and module. */
export const useQueryAgentDashboardSwr = (workspaceId: string | undefined, module: ModuleKey) =>
    useSWR(workspaceId ? [QUERY_AGENT_DASHBOARD_SWR_KEY, workspaceId, module] : null, async () => {
        const result = await queryAgentDashboard({ request: { module } })
        if (!result.data) throw new Error("agentDashboard answered no data")
        return agentDashboardOf(result.data.agentDashboard, module)
    })
