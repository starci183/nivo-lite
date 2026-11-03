import { useQueryChatbotOverviewSwr } from "@/hooks/swr"
import { overviewOf } from "@/hooks/chatbotWire"
import type { ChatbotOverview } from "@/modules/types"

/** The view `useChatbotOverview` returns. */
export interface ChatbotOverviewView extends Omit<ReturnType<typeof useQueryChatbotOverviewSwr>, "data"> {
    data: ChatbotOverview | undefined
}

/** The workspace inbox snapshot, refreshed by SWR polling. */
export const useChatbotOverview = (
    workspaceId: string | undefined,
    installationId: string | undefined,
): ChatbotOverviewView => {
    const query = useQueryChatbotOverviewSwr(workspaceId, installationId)
    return { ...query, data: query.data === undefined ? undefined : overviewOf(query.data) }
}
