"use client"

import { useCallback, useMemo, useState } from "react"
import { partiesOf } from "./teamChat.shared"
import { useTeamChatCards } from "./useTeamChatCards"
import type { TeamChatCardsView } from "./useTeamChatCards"
import { useTeamChatComposer } from "./useTeamChatComposer"
import type { TeamChatComposerView } from "./useTeamChatComposer"
import { useTeamChatNewChat } from "./useTeamChatNewChat"
import type { TeamChatNewChatView } from "./useTeamChatNewChat"
import { useTeamChatRooms } from "./useTeamChatRooms"
import type { TeamChatRoomsView, TeamChatScope } from "./useTeamChatRooms"
import { useTeamChatThread } from "./useTeamChatThread"
import type { TeamChatTab, TeamChatThreadView } from "./useTeamChatThread"

/** The whole state of the team chat of the open workspace, from the parts it is made of. */
export interface TeamChatState {
    readonly rooms: TeamChatRoomsView
    readonly thread: TeamChatThreadView
    readonly cards: TeamChatCardsView
    readonly composer: TeamChatComposerView
    readonly newChat: TeamChatNewChatView
    readonly tab: TeamChatTab
    /** The people and agents of the open room, the viewer left out: who the composer may mention. */
    readonly parties: ReturnType<typeof partiesOf>
    /** Chooses a room: its thread opens on all the messages. */
    readonly select: (roomId: string) => void
    readonly setTab: (tab: TeamChatTab) => void
    /** Reads the rooms, the unread counts and the thread again. */
    readonly refresh: () => void
}

/**
 * The team chat of the open workspace: the viewer's rooms, the open room with its thread and cards, the composer and the new-chat
 * form. The page lists every room; opened on an agent it follows the viewer's direct room with it and opens that room on the first
 * message, never on a read. `onRoomOpened` runs when the new-chat form opened a room.
 */
export const useTeamChatState = (scope: TeamChatScope, onRoomOpened: () => void): TeamChatState => {
    const rooms = useTeamChatRooms(scope)
    const [tab, setTabState] = useState<TeamChatTab>("all")
    const thread = useTeamChatThread({
        roomId: rooms.roomId,
        viewerId: rooms.viewerId,
        tab,
        unreadCount: rooms.room?.unreadCount ?? 0,
        onRead: rooms.refresh,
    })
    const refresh = useCallback((): void => {
        rooms.refresh()
        thread.refresh()
    }, [rooms, thread])
    const cards = useTeamChatCards(rooms.roomId, thread.refresh)
    const parties = useMemo(() => partiesOf(rooms.room, rooms.viewerId), [rooms.room, rooms.viewerId])
    const { select: chooseRoom } = rooms
    const select = useCallback(
        (roomId: string): void => {
            chooseRoom(roomId)
            setTabState("all")
        },
        [chooseRoom],
    )
    const composer = useTeamChatComposer({
        roomId: rooms.roomId,
        agentId: scope.withAgentId,
        parties,
        onSent: (roomId) => {
            select(roomId)
            refresh()
        },
    })
    const newChat = useTeamChatNewChat(rooms.open, onRoomOpened)
    return { rooms, thread, cards, composer, newChat, tab, parties, select, setTab: setTabState, refresh }
}
