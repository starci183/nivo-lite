"use client"

import useSWR from "swr"
import { queryChatMessages } from "@/modules/api/graphql/queries/query-chat-messages"
import { workspaceArgumentKey, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import type { ChatMessagesQuery } from "@/modules/api"
import { CHAT_PAGE_SIZE } from "@/modules/teamChat"

/** The identity of the messages cache. */
const QUERY_CHAT_MESSAGES_SWR_KEY = "QUERY_CHAT_MESSAGES_SWR"

/** Which page of which room: the cursor of the older page, none for the newest. */
interface ChatMessagesPage {
    readonly roomId: string
    readonly after?: string
    readonly pinnedOnly?: boolean
}

/** How often the open thread is read again while it is on screen. */
const THREAD_REFRESH_MS = 3000

/** One page of the messages of a room, newest first; the newest page follows the room by polling. `page` undefined waits. */
export const useQueryChatMessagesSwr = (
    workspaceId: string | undefined,
    page: ChatMessagesPage | undefined,
): ReadResponse<ChatMessagesQuery["chatMessages"]> =>
    useSWR(
        workspaceArgumentKey(QUERY_CHAT_MESSAGES_SWR_KEY, workspaceId, page),
        async ([, scope, wanted]: WorkspaceReadKey<ChatMessagesPage>) => {
            const result = await queryChatMessages({
                request: {
                    roomId: wanted.roomId,
                    first: CHAT_PAGE_SIZE,
                    ...(wanted.after === undefined ? {} : { after: wanted.after }),
                    ...(wanted.pinnedOnly === true ? { pinnedOnly: true } : {}),
                },
                headers: { "X-Workspace-Id": scope },
            })
            if (!result.data) throw new Error("chatMessages answered no data")
            return result.data.chatMessages
        },
        { refreshInterval: page?.after === undefined ? THREAD_REFRESH_MS : 0 },
    )
