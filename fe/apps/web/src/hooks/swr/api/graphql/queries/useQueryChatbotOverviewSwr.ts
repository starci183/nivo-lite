import useSWR from "swr"
import { queryChatbotOverview } from "@/modules/api/graphql/queries/query-chatbot-overview"

/** The SWR key of the chatbotOverview query. */
export const QUERY_CHATBOT_OVERVIEW_SWR_KEY = "QUERY_CHATBOT_OVERVIEW_SWR"

/** How often the inbox is read again. */
const CHATBOT_OVERVIEW_REFRESH_MS = 5_000

/** The chatbot inbox overview of one installation, read again every five seconds. */
export const useQueryChatbotOverviewSwr = (workspaceId: string | undefined, installationId: string | undefined) =>
    useSWR(
        workspaceId === undefined ? null : [QUERY_CHATBOT_OVERVIEW_SWR_KEY, workspaceId, installationId ?? null],
        async () => {
            const result = await queryChatbotOverview({ request: { installationId } })
            if (!result.data) throw new Error("chatbotOverview answered no data")
            return result.data.chatbotOverview
        },
        { refreshInterval: CHATBOT_OVERVIEW_REFRESH_MS },
    )
