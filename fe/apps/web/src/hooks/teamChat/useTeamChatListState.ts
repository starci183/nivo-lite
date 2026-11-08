"use client"

import { useTeamChatNewChat, type TeamChatNewChatView } from "./useTeamChatNewChat"
import { useTeamChatRooms, type TeamChatRoomsView } from "./useTeamChatRooms"

/** The state of the list of rooms: the rooms with the open one marked, and the new-chat form. */
export interface TeamChatListState {
    readonly rooms: TeamChatRoomsView
    readonly newChat: TeamChatNewChatView
}

/** The rooms of the viewer with the one the address names marked, and the new-chat form; `onOpened` runs with the room it opened. */
export const useTeamChatListState = (
    selectedId: string | null,
    onOpened: (roomId: string) => void,
): TeamChatListState => {
    const rooms = useTeamChatRooms({ roomId: selectedId, withAgentId: null })
    const newChat = useTeamChatNewChat(rooms.open, onOpened)
    return { rooms, newChat }
}
