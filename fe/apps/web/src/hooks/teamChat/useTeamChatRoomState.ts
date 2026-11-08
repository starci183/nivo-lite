"use client"

import { useMemo, useState } from "react"
import { partiesOf } from "./teamChat.shared"
import { useTeamChatCards, type TeamChatCardsView } from "./useTeamChatCards"
import { useTeamChatComposer, type TeamChatComposerView } from "./useTeamChatComposer"
import { useTeamChatRooms, type TeamChatRoomsView, type TeamChatTarget } from "./useTeamChatRooms"
import { useTeamChatThread, type TeamChatTab, type TeamChatThreadView } from "./useTeamChatThread"

/** The whole state of one open room: the room, its thread and cards, and the composer. */
export interface TeamChatRoomState {
    readonly rooms: TeamChatRoomsView
    readonly thread: TeamChatThreadView
    readonly cards: TeamChatCardsView
    readonly composer: TeamChatComposerView
    readonly tab: TeamChatTab
    /** The people and agents of the open room, the viewer left out: who the composer may mention. */
    readonly parties: ReturnType<typeof partiesOf>
    readonly setTab: (tab: TeamChatTab) => void
    /** Reads the rooms, the unread counts and the thread again. */
    readonly refresh: () => void
}

/**
 * One room of the team chat: the room the target names, or the direct room with the agent it names (opened on the first message,
 * never on a read), with its thread, its cards and its composer.
 */
export const useTeamChatRoomState = (target: TeamChatTarget): TeamChatRoomState => {
    const rooms = useTeamChatRooms(target)
    const [tab, setTab] = useState<TeamChatTab>("all")
    const thread = useTeamChatThread({
        roomId: rooms.roomId,
        viewerId: rooms.viewerId,
        tab,
        unreadCount: rooms.room?.unreadCount ?? 0,
        onRead: rooms.refresh,
    })
    const refresh = (): void => {
        rooms.refresh()
        thread.refresh()
    }
    const cards = useTeamChatCards(rooms.roomId, thread.refresh)
    const parties = useMemo(() => partiesOf(rooms.room, rooms.viewerId), [rooms.room, rooms.viewerId])
    const composer = useTeamChatComposer({
        roomId: rooms.roomId,
        agentId: target.withAgentId,
        parties,
        onSent: refresh,
    })
    return { rooms, thread, cards, composer, tab, parties, setTab, refresh }
}
