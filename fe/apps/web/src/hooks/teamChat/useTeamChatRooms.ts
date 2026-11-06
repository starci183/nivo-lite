"use client"

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

/** Which room is open: the one named by id, or the viewer's direct room with one agent (the first message to it opens the room). */
export interface TeamChatTarget {
    readonly roomId: string | null
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

/** The open room: the room the target names, else the direct room with the agent it names. */
const openOf = (target: TeamChatTarget, rooms: ReadonlyArray<ChatRoomNode>): ChatRoomNode | undefined => {
    if (target.roomId !== null) return rooms.find((room) => room.id === target.roomId)
    return target.withAgentId === null ? undefined : directWith(rooms, target.withAgentId)
}

/** The rooms of the viewer in the open workspace, the open one, and what is done to a room: choose it, mute it, open another. */
export const useTeamChatRooms = (target: TeamChatTarget): TeamChatRoomsView => {
    const workspaceId = useWorkspaceId()
    const viewerId = useMember()?.userId ?? ""
    const words = useChatRowWords()
    const rooms = useQueryChatRoomsSwr(workspaceId, {})
    const unread = useQueryChatUnreadSwr(workspaceId)
    const mute = useMutateSetChatRoomMutedSwr(workspaceId ?? "")
    const create = useMutateCreateChatRoomSwr(workspaceId ?? "")
    const room = rooms.data === undefined ? undefined : openOf(target, rooms.data)
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
            refresh()
            return made.room.id
        },
    }
}
