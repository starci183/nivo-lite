"use client"

import { useCallback, useMemo } from "react"
import {
    useMutateMarkOfficeConversationReadSwr,
    useQueryConnectionsSwr,
    useQueryOfficeConversationUnreadSwr,
    useQueryOfficeRoomsSwr,
} from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { OFFICE_POLL_MS, toOfficeRoom } from "@/modules/office"
import type {
    OfficeAgentConversation,
    OfficeChannelWire,
    OfficeConversationUnread,
    OfficeMentionViewer,
    OfficeRoom,
} from "@/modules/office"
import { useOfficeMarkers } from "./useOfficeMarkers"
import { useOfficeTyping } from "./useOfficeTyping"

const LIVE = { refreshInterval: OFFICE_POLL_MS }

const unreadOf = (entries: ReadonlyArray<{ readonly id: string; readonly unread: number }> | undefined) =>
    new Map((entries ?? []).map((entry) => [entry.id, entry.unread]))

const agentConversationsOf = (entries: ReadonlyArray<{ readonly id: string } & OfficeAgentConversation> | undefined) =>
    new Map((entries ?? []).map((entry) => [entry.id, { unread: entry.unread, last: entry.last }]))

/**
 * The Hub rooms and the direct conversations with the caller's unread counts, and the workspace channels the room panel
 * lists. `markConversationRead` records that the person read an agent's or a customer's
 * conversation (opening it); the room on screen never shows a badge. Each room also carries the caller's side of it: the mute
 * and whether my last line was read (`markers`), and who types in each room.
 */
export const useOfficeRooms = (selected: string | null, viewer: OfficeMentionViewer) => {
    const rooms = useQueryOfficeRoomsSwr(LIVE)
    const unread = useQueryOfficeConversationUnreadSwr(LIVE)
    const { markers, setMute } = useOfficeMarkers((rooms.data ?? []).map((room) => room.key ?? null))
    const peers = useOfficeTyping(selected)
    const connections = useQueryConnectionsSwr()
    const markConversation = useMutateMarkOfficeConversationReadSwr()
    const runGraphQL = useGraphQLWithToast()
    const { trigger: triggerConversation } = markConversation
    const { mutate } = rooms
    const { mutate: mutateUnread } = unread
    const list: ReadonlyArray<OfficeRoom> = (
        rooms.data?.map((row) =>
            toOfficeRoom(row, markers.get(row.key ?? ""), (peers.byRoom.get(row.key ?? "")?.length ?? 0) > 0, viewer),
        ) ?? []
    ).map((room) => (room.key === selected ? { ...room, unread: 0 } : room))
    const conversationUnread: OfficeConversationUnread = useMemo(
        () => ({ agents: agentConversationsOf(unread.data?.agents), leads: unreadOf(unread.data?.leads) }),
        [unread.data],
    )
    const refreshRooms = useCallback(() => {
        void mutate()
    }, [mutate])
    const markConversationRead = useCallback(
        async (kind: "agent" | "lead", id: string) => {
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
    return {
        rooms: list,
        channels,
        unread: conversationUnread,
        markers,
        refreshRooms,
        markConversationRead,
        setMute,
        peers,
    }
}
