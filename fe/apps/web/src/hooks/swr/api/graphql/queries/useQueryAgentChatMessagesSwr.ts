import useSWR from "swr"
import { queryAgentChatMessages } from "@/modules/api/graphql/queries/query-agent-chat-messages"

/** SWR identity for one conversation's thread. */
export const QUERY_AGENT_CHAT_MESSAGES_SWR_KEY = "QUERY_AGENT_CHAT_MESSAGES_SWR"

/** Follows the selected thread through SWR polling, without a Supabase data client. */
export const useQueryAgentChatMessagesSwr = (workspaceId: string | undefined, conversationId: string | null) =>
    useSWR(
        workspaceId === undefined || conversationId === null
            ? null
            : [QUERY_AGENT_CHAT_MESSAGES_SWR_KEY, workspaceId, conversationId],
        async ([, scope, id]: [string, string, string]) => {
            const result = await queryAgentChatMessages({
                request: { conversationId: id },
                headers: { "X-Workspace-Id": scope },
            })
            if (!result.data) throw new Error("agentChatMessages answered no data")
            return result.data.agentChatMessages
        },
        { refreshInterval: 3000 },
    )
