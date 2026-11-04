"use client"

import { useCallback, useMemo } from "react"
import {
    useMutateMarkOfficeConversationReadSwr,
    useQueryConnectionsSwr,
    useQueryOfficeConversationUnreadSwr,
    useQueryChatMarkerStateSwr,
    useQueryOfficeRoomsSwr,
} from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { toOfficeRoom } from "@/modules/office"
import type {
    ChatMarkerWire,
    OfficeAgentConversation,
    OfficeChannelWire,
    OfficeConversationUnread,
    OfficeMentionViewer,
    OfficeRoom,
    TypingSignal,
} from "@/modules/office"
import { useOfficeMarkers } from "./useOfficeMarkers"
import { useOfficeTyping } from "./useOfficeTyping"

const unreadOf = (entries: ReadonlyArray<{ readonly id: string; readonly unread: number }> | undefined) =>
    new Map((entries ?? []).map((entry) => [entry.id, entry.unread]))

const agentConversationsOf = (entries: ReadonlyArray<{ readonly id: string } & OfficeAgentConversation> | undefined) =>
    new Map((entries ?? []).map((entry) => [entry.id, { unread: entry.unread, last: entry.last }]))

type RoomsRead = ReturnType<typeof useQueryOfficeRoomsSwr>
type MarkersRead = ReturnType<typeof useQueryChatMarkerStateSwr>
type UnreadRead = ReturnType<typeof useQueryOfficeConversationUnreadSwr>
type ConnectionsRead = ReturnType<typeof useQueryConnectionsSwr>

type UseOfficeRoomsResult = {
    rooms: readonly OfficeRoom[]
    roomRead: RoomsRead
    markerRead: MarkersRead
    listReads: (RoomsRead | MarkersRead | UnreadRead | ConnectionsRead)[]
    reload: () => void
    isLoading: boolean
    error: unknown
    channels: readonly OfficeChannelWire[]
    unread: OfficeConversationUnread
    markers: ReadonlyMap<string, ChatMarkerWire | undefined>
    refreshRooms: () => void
    reloadMarkers: () => void
    markConversationRead: (kind: "agent" | "lead", id: string) => Promise<void>
    setMute: (room: string | null, muted: boolean) => Promise<void>
    peers: {
        names: string[]
        byRoom: ReadonlyMap<string, readonly TypingSignal[]>
        onDraft: (draft: string) => void
    }
}

/**
 * The Hub rooms and the direct conversations with the caller's unread counts, and the workspace channels the room panel
 * lists. `markConversationRead` records that the person read an agent's or a customer's
 * conversation (opening it); the room on screen never shows a badge. Each room also carries the caller's side of it: the mute
 * and whether my last line was read (`markers`), and who types in each room.
 */
export const useOfficeRooms = (selected: string | null, viewer: OfficeMentionViewer): UseOfficeRoomsResult => {
    const rooms = useQueryOfficeRoomsSwr()
    const unread = useQueryOfficeConversationUnreadSwr()
    const markerState = useOfficeMarkers((rooms.data ?? []).map((room) => room.key ?? null))
    const { markers, setMute } = markerState
    const peers = useOfficeTyping(selected)
    const connections = useQueryConnectionsSwr()
    const markConversation = useMutateMarkOfficeConversationReadSwr()
    const runGraphQL = useGraphQLWithToast()
    const { trigger: triggerConversation } = markConversation
    const { mutate } = rooms
    const { mutate: mutateUnread } = unread
    const { mutate: mutateMarkers } = markerState.read
    const list: ReadonlyArray<OfficeRoom> = (
        rooms.data?.map((row) =>
            toOfficeRoom(row, markers.get(row.key ?? ""), (peers.byRoom.get(row.key ?? "")?.length ?? 0) > 0, viewer),
        ) ?? []
    ).map((room) => (room.key === selected ? { ...room, unread: 0 } : room))
    const conversationUnread: OfficeConversationUnread = useMemo(
        () => ({ agents: agentConversationsOf(unread.data?.agents), leads: unreadOf(unread.data?.leads) }),
        [unread.data],
    )
    const refreshRooms = useCallback((): void => {
        void mutate()
    }, [mutate])
    const reloadMarkers = useCallback((): void => {
        mutateMarkers().catch((error: unknown) => runGraphQL(() => Promise.reject(error), { showSuccessToast: false }))
    }, [runGraphQL, mutateMarkers])
    const markConversationRead = useCallback(
        async (kind: "agent" | "lead", id: string): Promise<void> => {
            const done = await runGraphQL(() => triggerConversation({ kind, id }), { showSuccessToast: false })
            if (done !== undefined) await mutateUnread()
        },
        [runGraphQL, triggerConversation, mutateUnread],
    )
    const channels: ReadonlyArray<OfficeChannelWire> = (connections.data ?? []).map((connection) => ({
        id: connection.id,
        provider: connection.provider,
        name: connection.name,
        status: connection.status,
        agentIds: connection.agentIds,
    }))
    const error: unknown = rooms.error ?? unread.error ?? connections.error ?? markerState.error
    return {
        rooms: list,
        roomRead: rooms,
        markerRead: markerState.read,
        listReads: [rooms, unread, connections, markerState.read],
        reload: (): void => {
            void rooms.mutate()
            void unread.mutate()
            void connections.mutate()
            reloadMarkers()
        },
        isLoading: rooms.isLoading || unread.isLoading || connections.isLoading || markerState.isLoading,
        error,
        channels,
        unread: conversationUnread,
        markers,
        refreshRooms,
        reloadMarkers,
        markConversationRead,
        setMute,
        peers,
    }
}
