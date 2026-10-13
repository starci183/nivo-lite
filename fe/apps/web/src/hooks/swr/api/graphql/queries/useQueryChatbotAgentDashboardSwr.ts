import useSWR from "swr"
import { queryChatbotAgentDashboard } from "@/modules/api/graphql/queries/query-chatbot-agent-dashboard"

/** The SWR key of the chatbot agentDashboard query. */
export const QUERY_CHATBOT_AGENT_DASHBOARD_SWR_KEY = "QUERY_CHATBOT_AGENT_DASHBOARD_SWR"

/** How often the workbench frame is read again. */
const AGENT_DASHBOARD_REFRESH_MS = 10_000

/** The chatbot workbench frame of one installation, read again every ten seconds. */
export const useQueryChatbotAgentDashboardSwr = (workspaceId: string | undefined, installationId: string | undefined) =>
    useSWR(
        workspaceId === undefined ? null : [QUERY_CHATBOT_AGENT_DASHBOARD_SWR_KEY, workspaceId, installationId ?? null],
        async () => {
            const result = await queryChatbotAgentDashboard({ request: { module: "chatbot", installationId } })
            if (!result.data) throw new Error("agentDashboard answered no data")
            return result.data.agentDashboard
        },
        { refreshInterval: AGENT_DASHBOARD_REFRESH_MS },
    )
