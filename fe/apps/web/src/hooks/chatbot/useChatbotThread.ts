import { useQueryChatbotThreadSwr } from "@/hooks/swr/api/graphql/queries/useQueryChatbotThreadSwr"
import { threadOf } from "@/hooks/chatbotWire"

/** The selected conversation only; changing the selection never displays a previous thread. */
export const useChatbotThread = (workspaceId: string | undefined, conversationId: string | undefined) => {
    const query = useQueryChatbotThreadSwr(workspaceId, conversationId)
    return { ...query, data: query.data === undefined ? undefined : threadOf(query.data) }
}
