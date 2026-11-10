"use client"

import { useMemo, useState } from "react"
import { partiesOf } from "./teamChat.shared"
import { useTeamChatCards } from "./useTeamChatCards"
import type { TeamChatCardsView } from "./useTeamChatCards"
import { createPendingTaps } from "@/modules/teamChat"
import { useTeamChatComposer } from "./useTeamChatComposer"
import type { TeamChatComposerView } from "./useTeamChatComposer"
import { useTeamChatRooms } from "./useTeamChatRooms"
import type { TeamChatRoomsView, TeamChatTarget } from "./useTeamChatRooms"
import { useTeamChatPinned } from "./useTeamChatPinned"
import type { TeamChatPinnedView } from "./useTeamChatPinned"
import { useTeamChatForward } from "./useTeamChatForward"
import type { TeamChatForwardState } from "./useTeamChatForward"
import { useTeamChatReactions } from "./useTeamChatReactions"
import type { TeamChatReactionsView } from "./useTeamChatReactions"
import { useTeamChatThread } from "./useTeamChatThread"
import type { TeamChatThreadView } from "./useTeamChatThread"
import type { TeamChatMessageRow, TeamChatPanel } from "@/modules/types"

/** The whole state of one open room: the room, its thread and cards, and the composer. */
export interface TeamChatRoomState {
    readonly rooms: TeamChatRoomsView
    readonly thread: TeamChatThreadView
    readonly cards: TeamChatCardsView
    readonly composer: TeamChatComposerView
    /** The reactions: one tap of an emoji on a message. */
    readonly reactions: TeamChatReactionsView
    /** The message the draft answers, or null. */
    readonly replying: TeamChatMessageRow | null
    /** The dialog that forwards a message into another room. */
    readonly forward: TeamChatForwardState
    /** The pinned messages, read while their panel is open. */
    readonly pinned: TeamChatPinnedView
    /** The panel the head opened over the thread, or null. */
    readonly panel: TeamChatPanel | null
    /** The people and agents of the open room, the viewer left out: who the composer may mention. */
    readonly parties: ReturnType<typeof partiesOf>
    readonly setPanel: (panel: TeamChatPanel | null) => void
    /** Makes the draft an answer to a message of the thread; null clears it. */
    readonly setReplying: (messageId: string | null) => void
    /** Reads the rooms, the unread counts and the thread again. */
    readonly refresh: () => void
}

/**
 * One room of the team chat: the room the target names, or the direct room with the agent it names (opened on the first message,
 * never on a read), with its thread, its cards and its composer.
 */
export const useTeamChatRoomState = (target: TeamChatTarget): TeamChatRoomState => {
    const rooms = useTeamChatRooms(target)
    const [panel, setPanel] = useState<TeamChatPanel | null>(null)
    const [pending] = useState(createPendingTaps)
    const [replyId, setReplyId] = useState<string | null>(null)
    const thread = useTeamChatThread({
        roomId: rooms.roomId,
        viewerId: rooms.viewerId,
        unreadCount: rooms.room?.unreadCount ?? 0,
        onRead: rooms.refresh,
        pending,
    })
    const refresh = (): void => {
        rooms.refresh()
        thread.refresh()
    }
    const pinned = useTeamChatPinned(rooms.roomId, rooms.viewerId, panel === "pinned", pending)
    const reactions = useTeamChatReactions({
        pending,
        onConfirmed: thread.setReactions,
        onSettled: () => {
            thread.refresh()
            pinned.refresh()
        },
    })
    const forward = useTeamChatForward({ roomId: rooms.roomId, viewerId: rooms.viewerId, onForwarded: rooms.refresh })
    const replying = [...thread.rows, ...pinned.rows].find((row) => row.id === replyId) ?? null
    const cards = useTeamChatCards(rooms.roomId, () => {
        thread.refresh()
        pinned.refresh()
    })
    const parties = useMemo(() => partiesOf(rooms.room, rooms.viewerId), [rooms.room, rooms.viewerId])
    const composer = useTeamChatComposer({
        roomId: rooms.roomId,
        agentId: target.withAgentId,
        parties,
        replyTo: replyId,
        onSent: () => {
            setReplyId(null)
            refresh()
        },
    })
    return {
        rooms,
        thread,
        cards,
        composer,
        reactions,
        replying,
        forward,
        pinned,
        panel,
        parties,
        setPanel,
        setReplying: setReplyId,
        refresh,
    }
}
