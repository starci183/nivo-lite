"use client"

import { useCallback, useMemo } from "react"
import {
    useMutateMarkOfficeConversationReadSwr,
    useMutateMarkOfficeRoomReadSwr,
    useQueryConnectionsSwr,
    useQueryOfficeConversationUnreadSwr,
    useQueryOfficeRoomsSwr,
} from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { OFFICE_POLL_MS, toOfficeRoom } from "@/modules/office"
import type { OfficeAgentConversation, OfficeChannelWire, OfficeConversationUnread, OfficeRoom } from "@/modules/office"
import { useOfficeMarkers } from "./useOfficeMarkers"

const LIVE = { refreshInterval: OFFICE_POLL_MS }

const unreadOf = (entries: ReadonlyArray<{ readonly id: string; readonly unread: number }> | undefined) =>
    new Map((entries ?? []).map((entry) => [entry.id, entry.unread]))

const agentConversationsOf = (entries: ReadonlyArray<{ readonly id: string } & OfficeAgentConversation> | undefined) =>
    new Map((entries ?? []).map((entry) => [entry.id, { unread: entry.unread, last: entry.last }]))

/**
 * The Hub rooms and the direct conversations with the caller's unread counts, and the workspace channels the room panel
 * lists. `markRead` records that the person read a room, `markConversationRead` that they read an agent's or a customer's
 * conversation (opening it); the room on screen never shows a badge. Each room also carries the caller's side of it: the mute
 * and whether my last line was read (`markers`), and `isTypingHere` says someone types in the room on screen.
 */
export const useOfficeRooms = (selected: string | null, isTypingHere = false) => {
    const rooms = useQueryOfficeRoomsSwr(LIVE)
    const unread = useQueryOfficeConversationUnreadSwr(LIVE)
    const { markers, setMute } = useOfficeMarkers((rooms.data ?? []).map((room) => room.key ?? null))
    const connections = useQueryConnectionsSwr()
    const markRoom = useMutateMarkOfficeRoomReadSwr()
    const markConversation = useMutateMarkOfficeConversationReadSwr()
    const runGraphQL = useGraphQLWithToast()
    const { trigger } = markRoom
    const { trigger: triggerConversation } = markConversation
    const { mutate } = rooms
    const { mutate: mutateUnread } = unread
    const list: ReadonlyArray<OfficeRoom> = (
        rooms.data?.map((row) =>
            toOfficeRoom(row, markers.get(row.key ?? ""), isTypingHere && (row.key ?? null) === selected),
        ) ?? []
    ).map((room) => (room.key === selected ? { ...room, unread: 0 } : room))
    const conversationUnread: OfficeConversationUnread = useMemo(
        () => ({ agents: agentConversationsOf(unread.data?.agents), leads: unreadOf(unread.data?.leads) }),
        [unread.data],
    )
    const markRead = useCallback(
        async (room: string | null) => {
            const done = await runGraphQL(() => trigger({ room }), { showSuccessToast: false })
            if (done !== undefined) await mutate()
        },
        [runGraphQL, trigger, mutate],
    )
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
    return { rooms: list, channels, unread: conversationUnread, markers, markRead, markConversationRead, setMute }
}
