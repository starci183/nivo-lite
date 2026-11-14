"use client"

import { useQueryChatUnreadSwr, useQueryMyWorkInHandSwr } from "@/hooks/swr"
import { useTeamChatRooms } from "@/hooks/teamChat"
import { useWorkspaceId } from "@/hooks/workspaces"
import type { TeamChatRoomRow } from "@/modules/types"

/** How many rows each list of the staff home shows. */
const HOME_ROWS = 5

/** What the staff home is drawn from. A count is undefined until it is read. */
export interface StaffHomeData {
    /** Open work items given to the person. */
    readonly assigned: number | undefined
    /** Unread chat messages. */
    readonly unread: number | undefined
    readonly rooms: ReadonlyArray<TeamChatRoomRow>
    readonly isWorkLoading: boolean
    readonly isChatsLoading: boolean
}

/** The staff home of the open workspace (read only while `enabled`): the work in hand and the recent chats, read from the queries the pages already use. */
export const useStaffHome = (enabled = true): StaffHomeData => {
    const workspaceId = useWorkspaceId()
    const assigned = useQueryMyWorkInHandSwr(enabled ? workspaceId : undefined)
    const rooms = useTeamChatRooms({ roomId: null, withAgentId: null }, enabled)
    const unread = useQueryChatUnreadSwr(enabled ? workspaceId : undefined)
    const roomRows = "items" in rooms.slot ? rooms.slot.items : []
    return {
        assigned: assigned.data,
        unread: unread.data?.total,
        rooms: roomRows.slice(0, HOME_ROWS),
        isWorkLoading: assigned.isLoading,
        isChatsLoading: rooms.isLoading,
    }
}
