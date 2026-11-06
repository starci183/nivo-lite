"use client"

import useSWRInfinite from "swr/infinite"
import { queryChatMessages } from "@/modules/api/graphql/queries/query-chat-messages"
import type { ChatMessagesQuery } from "@/modules/api"
import type { SWRInfiniteResponse } from "swr/infinite"

/** The identity of the messages cache. */
export const QUERY_CHAT_MESSAGES_SWR_KEY = "QUERY_CHAT_MESSAGES_SWR"

/** Which messages of which room: all of them, or the pinned ones. */
interface ChatMessagesWanted {
    readonly roomId: string
    readonly pinnedOnly: boolean
}

/** What one read of the messages tells its owner. */
interface ChatMessagesOptions {
    /** Called with the newest page each time it is read, the poll included: the owner marks what it now shows as read. */
    readonly onNewestPage?: (page: ChatMessagesQuery["chatMessages"]) => void
}

/** How many messages one page holds. */
const PAGE_SIZE = 30

/** How often the newest page of the open thread is read again while it is on screen (milliseconds). */
const THREAD_REFRESH_MS = 3000

/** The key of one page: the room, the filter and the cursor that page starts after (none for the newest). */
type ChatMessagesKey = readonly [string, string, string, boolean, string | null]

/**
 * The messages of one room, newest first, a page at a time: the newest page follows the room by polling, and `setSize` loads the
 * next older page. `wanted` undefined waits.
 */
export const useQueryChatMessagesSwr = (
    workspaceId: string | undefined,
    wanted: ChatMessagesWanted | undefined,
    options: ChatMessagesOptions,
): SWRInfiniteResponse<ChatMessagesQuery["chatMessages"], Error> =>
    useSWRInfinite(
        (index: number, previous: ChatMessagesQuery["chatMessages"] | null): ChatMessagesKey | null => {
            if (workspaceId === undefined || wanted === undefined) return null
            if (index > 0 && !previous?.pageInfo.hasNextPage) return null
            return [
                QUERY_CHAT_MESSAGES_SWR_KEY,
                workspaceId,
                wanted.roomId,
                wanted.pinnedOnly,
                previous?.pageInfo.endCursor ?? null,
            ]
        },
        async ([, scope, roomId, pinnedOnly, after]: ChatMessagesKey) => {
            const result = await queryChatMessages({
                request: {
                    roomId,
                    first: PAGE_SIZE,
                    ...(after === null ? {} : { after }),
                    ...(pinnedOnly ? { pinnedOnly } : {}),
                },
                headers: { "X-Workspace-Id": scope },
            })
            if (!result.data) throw new Error("chatMessages answered no data")
            return result.data.chatMessages
        },
        {
            refreshInterval: THREAD_REFRESH_MS,
            revalidateAll: false,
            onSuccess: (pages) => {
                const newest = pages[0]
                if (newest !== undefined) options.onNewestPage?.(newest)
            },
        },
    )
