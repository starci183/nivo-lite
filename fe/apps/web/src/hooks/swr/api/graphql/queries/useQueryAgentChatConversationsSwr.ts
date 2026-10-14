"use client"

import useSWR from "swr"
import { queryAgentChatConversations } from "@/modules/api/graphql/queries/query-agent-chat-conversations"

/** SWR identity for an agent's conversations. */
export const QUERY_AGENT_CHAT_CONVERSATIONS_SWR_KEY = "QUERY_AGENT_CHAT_CONVERSATIONS_SWR"

/** Follows customer conversations and staff takeover through SWR polling. */
export const useQueryAgentChatConversationsSwr = (workspaceId: string | undefined, agentId: string | undefined) =>
    useSWR(
        workspaceId === undefined || agentId === undefined
            ? null
            : [QUERY_AGENT_CHAT_CONVERSATIONS_SWR_KEY, workspaceId, agentId],
        async ([, scope, id]: [string, string, string]) => {
            const result = await queryAgentChatConversations({
                request: { agentId: id },
                headers: { "X-Workspace-Id": scope },
            })
            if (!result.data) throw new Error("agentChatConversations answered no data")
            return result.data.agentChatConversations
        },
        { refreshInterval: 5000 },
    )
