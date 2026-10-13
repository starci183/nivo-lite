import useSWR from "swr"
import { queryLeadGenAgentDashboard } from "@/modules/api/graphql/queries/query-lead-gen-agent-dashboard"
import { toLeadGenAgentDashboard } from "@/modules/utils/leadgen"

/** The SWR key of the Lead Gen agentDashboard query. */
export const QUERY_LEAD_GEN_AGENT_DASHBOARD_SWR_KEY = "QUERY_LEAD_GEN_AGENT_DASHBOARD_SWR"

/** The common frame of one Lead Gen instance. */
export const useQueryLeadGenAgentDashboardSwr = (workspaceId: string | undefined, installationId: string | null) =>
    useSWR(
        workspaceId === undefined ? null : [QUERY_LEAD_GEN_AGENT_DASHBOARD_SWR_KEY, workspaceId, installationId],
        async () => {
            const result = await queryLeadGenAgentDashboard({ request: { module: "lead_gen", installationId } })
            if (!result.data) throw new Error("agentDashboard answered no data")
            return toLeadGenAgentDashboard(result.data.agentDashboard, installationId)
        },
    )
