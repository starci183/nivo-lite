import { useQueryChatbotOverviewSwr } from "@/hooks/swr"
import { overviewOf } from "@/hooks/chatbotWire"

/** The workspace inbox snapshot, refreshed by SWR polling. */
export const useChatbotOverview = (workspaceId: string | undefined, installationId: string | undefined) => {
    const query = useQueryChatbotOverviewSwr(workspaceId, installationId)
    return { ...query, data: query.data === undefined ? undefined : overviewOf(query.data) }
}
