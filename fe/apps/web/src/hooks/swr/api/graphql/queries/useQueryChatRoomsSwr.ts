"use client"

import useSWR from "swr"
import { queryChatRooms } from "@/modules/api/graphql/queries/query-chat-rooms"
import { workspaceArgumentKey, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import type { ChatRoomsQuery } from "@/modules/api"

/** The identity of the rooms cache. */
export const QUERY_CHAT_ROOMS_SWR_KEY = "QUERY_CHAT_ROOMS_SWR"

/** Which rooms to list: the kind, and a member for the direct room with that agent or person. Both optional. */
export interface ChatRoomsFilter {
    readonly kind?: "direct" | "group"
    readonly member?: string
}

/** How often the room list is read again while it is on screen. */
const ROOMS_REFRESH_MS = 5000

/** The rooms of the viewer in the active workspace, newest message first, refreshed while visible. `filter` undefined waits. */
export const useQueryChatRoomsSwr = (
    workspaceId: string | undefined,
    filter: ChatRoomsFilter | undefined,
): ReadResponse<ChatRoomsQuery["chatRooms"]> =>
    useSWR(
        workspaceArgumentKey(QUERY_CHAT_ROOMS_SWR_KEY, workspaceId, filter),
        async ([, scope, narrowed]: WorkspaceReadKey<ChatRoomsFilter>) => {
            const result = await queryChatRooms({
                request: {
                    ...(narrowed.kind === undefined ? {} : { kind: narrowed.kind }),
                    ...(narrowed.member === undefined ? {} : { member: narrowed.member }),
                },
                headers: { "X-Workspace-Id": scope },
            })
            if (!result.data) throw new Error("chatRooms answered no data")
            return result.data.chatRooms
        },
        { refreshInterval: ROOMS_REFRESH_MS },
    )
