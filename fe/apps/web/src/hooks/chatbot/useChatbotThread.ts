import { useQueryChatbotThreadSwr } from "@/hooks/swr"
import { threadOf } from "@/hooks/chatbotWire"
import type { ChatbotThread } from "@/modules/types"

/** The view `useChatbotThread` returns. */
export interface ChatbotThreadQuery extends Omit<ReturnType<typeof useQueryChatbotThreadSwr>, "data"> {
    data: ChatbotThread | undefined
}

/** The selected conversation only; changing the selection never displays a previous thread. */
export const useChatbotThread = (
    workspaceId: string | undefined,
    conversationId: string | undefined,
): ChatbotThreadQuery => {
    const query = useQueryChatbotThreadSwr(workspaceId, conversationId)
    return { ...query, data: query.data === undefined ? undefined : threadOf(query.data) }
}
