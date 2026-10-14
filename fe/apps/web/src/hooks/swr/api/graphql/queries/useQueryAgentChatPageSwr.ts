"use client"

import useSWR from "swr"
import { queryAgentChatPage } from "@/modules/api/graphql/queries/query-agent-chat-page"

/** SWR identity for chat metadata. */
export const QUERY_AGENT_CHAT_PAGE_SWR_KEY = "QUERY_AGENT_CHAT_PAGE_SWR"

/** Loads the agent only after an active workspace has been selected. */
export const useQueryAgentChatPageSwr = (
    workspaceId: string | undefined,
    agentId: string | undefined,
    welcome: boolean,
) =>
    useSWR(
        workspaceId === undefined || agentId === undefined
            ? null
            : [QUERY_AGENT_CHAT_PAGE_SWR_KEY, workspaceId, agentId, welcome],
        async ([, scope, id, welcomeFlag]: [string, string, string, boolean]) => {
            const result = await queryAgentChatPage({
                request: { agentId: id, welcome: welcomeFlag },
                headers: { "X-Workspace-Id": scope },
            })
            if (!result.data) throw new Error("agentChatPage answered no data")
            return result.data.agentChatPage
        },
        { keepPreviousData: true },
    )
