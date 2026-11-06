"use client"

import { useState } from "react"
import { mapSlot, slotOfSwr } from "@/hooks/slot"
import { useMember } from "@/hooks/member"
import {
    useMutateCreateChatRoomSwr,
    useMutateSetChatRoomMutedSwr,
    useQueryChatRoomsSwr,
    useQueryChatUnreadSwr,
} from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import type { ChatParty, DataSlot, TeamChatRoomRow } from "@/modules/types"
import { otherPartyOf, roomRowsOf } from "./teamChat.shared"
import type { ChatRoomNode } from "./teamChat.shared"
import { useChatRowWords } from "./useChatRowWords"

/** What the chat opens on: every room of the viewer, on the room the address names or the direct room with the agent it names. */
export interface TeamChatScope {
    readonly kind: "page"
    /** The room the address names, or null. */
    readonly initialRoomId: string | null
    /** The agent the address asks to talk to, or null: its direct room opens, and the first message opens it when none exists. */
    readonly withAgentId: string | null
}

/** The room a person asks to open: a direct room with one party, or a named group. */
interface NewRoom {
    readonly kind: "direct" | "group"
    readonly name?: string
    readonly members: ReadonlyArray<ChatParty>
}

/** The view `useTeamChatRooms` returns. */
export interface TeamChatRoomsView {
    readonly slot: DataSlot<ReadonlyArray<TeamChatRoomRow>>
    /** The rooms are still being read for the first time. */
    readonly isLoading: boolean
    readonly room: ChatRoomNode | undefined
    readonly roomId: string | null
    readonly isMuted: boolean
    /** Who a direct open room is with; null for a group or none open. */
    readonly other: ChatParty | null
    readonly viewerId: string
    readonly select: (roomId: string) => void
    readonly toggleMute: () => Promise<void>
    /** Opens a room and answers its id, or null when the door refused. */
    readonly open: (input: NewRoom) => Promise<string | null>
    readonly refresh: () => void
}

/** The direct room of the viewer with one agent, among the rooms; none when no message was ever sent. */
const directWith = (rooms: ReadonlyArray<ChatRoomNode>, agentId: string): ChatRoomNode | undefined =>
    rooms.find(
        (room) =>
            room.kind === "direct" && room.members.some((m) => m.memberKind === "agent" && m.memberId === agentId),
    )

/** The open room: the chosen one; before one is chosen the direct room with the agent the address names, else the first. */
const openOf = (scope: TeamChatScope, rooms: ReadonlyArray<ChatRoomNode>, chosen: string | null) => {
    if (chosen !== null) return rooms.find((room) => room.id === chosen)
    return scope.withAgentId === null ? rooms[0] : directWith(rooms, scope.withAgentId)
}

/** The rooms of the viewer in the open workspace, the open one, and what is done to a room: choose it, mute it, open another. */
export const useTeamChatRooms = (scope: TeamChatScope): TeamChatRoomsView => {
    const workspaceId = useWorkspaceId()
    const viewerId = useMember()?.userId ?? ""
    const words = useChatRowWords()
    const rooms = useQueryChatRoomsSwr(workspaceId, {})
    const unread = useQueryChatUnreadSwr(workspaceId)
    const mute = useMutateSetChatRoomMutedSwr(workspaceId ?? "")
    const create = useMutateCreateChatRoomSwr(workspaceId ?? "")
    const [chosen, setChosen] = useState<string | null>(scope.initialRoomId)
    const room = rooms.data === undefined ? undefined : openOf(scope, rooms.data, chosen)
    const roomId = room?.id ?? null
    const rows = rooms.data === undefined ? [] : roomRowsOf(rooms.data, roomId, viewerId, words)
    const { mutate: refreshRooms } = rooms
    const { mutate: refreshUnread } = unread
    const refresh = (): void => {
        void refreshRooms()
        void refreshUnread()
    }
    return {
        slot: mapSlot(slotOfSwr(rooms), () => rows),
        isLoading: rooms.isLoading,
        room,
        roomId,
        isMuted: room?.muted === true,
        other: room === undefined ? null : otherPartyOf(room, viewerId),
        viewerId,
        select: setChosen,
        refresh,
        toggleMute: async () => {
            if (roomId === null) return
            await mute.trigger({ roomId, muted: room?.muted !== true })
            refresh()
        },
        open: async (input) => {
            const made = await create.trigger({
                kind: input.kind,
                ...(input.name === undefined ? {} : { name: input.name }),
                members: input.members.map((party) => ({ memberKind: party.kind, memberId: party.id })),
            })
            if (made.room === null) return null
            setChosen(made.room.id)
            refresh()
            return made.room.id
        },
    }
}
