"use client"

import useSWR from "swr"
import { queryChatUnread } from "@/modules/api/graphql/queries/query-chat-unread"
import { argumentKey, type ReadResponse } from "@/hooks/workspaceread"
import type { ChatUnreadQuery } from "@/modules/api"

/** The identity of the unread cache. */
const QUERY_CHAT_UNREAD_SWR_KEY = "QUERY_CHAT_UNREAD_SWR"

/** How often the unread counts are read again. */
const UNREAD_REFRESH_MS = 10000

/** The unread and mention counts of the viewer in the active workspace (the badge of the rail). `workspaceId` undefined waits. */
export const useQueryChatUnreadSwr = (workspaceId: string | undefined): ReadResponse<ChatUnreadQuery["chatUnread"]> =>
    useSWR(
        argumentKey(QUERY_CHAT_UNREAD_SWR_KEY, workspaceId),
        async ([, scope]: readonly [string, string]) => {
            const result = await queryChatUnread({ headers: { "X-Workspace-Id": scope } })
            if (!result.data) throw new Error("chatUnread answered no data")
            return result.data.chatUnread
        },
        { refreshInterval: UNREAD_REFRESH_MS },
    )
