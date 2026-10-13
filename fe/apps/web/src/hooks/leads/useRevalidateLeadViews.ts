import { useCallback } from "react"
import { useSWRConfig } from "swr"
import { QUERY_AGENT_DASHBOARD_SWR_KEY } from "@/hooks/swr/api/graphql/queries/useQueryAgentDashboardSwr"
import { QUERY_LEAD_BOARD_SWR_KEY } from "@/hooks/swr/api/graphql/queries/useQueryLeadBoardSwr"
import { QUERY_LEAD_FLOW_SWR_KEY } from "@/hooks/swr/api/graphql/queries/useQueryLeadFlowSwr"
import { QUERY_LEAD_GEN_WORKBENCH_SWR_KEY } from "@/hooks/swr/api/graphql/queries/useQueryLeadGenWorkbenchSwr"
import { QUERY_LEAD_JOURNEY_SWR_KEY } from "@/hooks/swr/api/graphql/queries/useQueryLeadJourneySwr"
import { QUERY_LEAD_WAIT_SWR_KEY } from "@/hooks/swr/api/graphql/queries/useQueryLeadWaitSwr"
import { QUERY_PROMO_CHATBOT_STATE_SWR_KEY } from "@/hooks/swr/api/graphql/queries/useQueryPromoChatbotStateSwr"
import { QUERY_SALES_WORKBENCH_SWR_KEY } from "@/hooks/swr/api/graphql/queries/useQuerySalesWorkbenchSwr"
import { useActiveWorkspace } from "@/hooks/workspaces"

const LEAD_VIEW_KEYS: ReadonlyArray<string> = [
    QUERY_LEAD_BOARD_SWR_KEY,
    QUERY_LEAD_JOURNEY_SWR_KEY,
    QUERY_LEAD_FLOW_SWR_KEY,
    QUERY_LEAD_WAIT_SWR_KEY,
    QUERY_LEAD_GEN_WORKBENCH_SWR_KEY,
    QUERY_PROMO_CHATBOT_STATE_SWR_KEY,
    QUERY_AGENT_DASHBOARD_SWR_KEY,
    QUERY_SALES_WORKBENCH_SWR_KEY,
]

/** Reads again every lead-derived view of the active workspace (board, journey, flow, workbenches, dashboards) after a write. */
export const useRevalidateLeadViews = () => {
    const { mutate } = useSWRConfig()
    const { activeWorkspaceId } = useActiveWorkspace()
    return useCallback(
        () =>
            mutate(
                (key) => Array.isArray(key) && key[1] === activeWorkspaceId && LEAD_VIEW_KEYS.includes(String(key[0])),
            ),
        [activeWorkspaceId, mutate],
    )
}
