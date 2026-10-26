"use client"

import { useCallback, useMemo } from "react"
import {
    useMutateMarkOfficeConversationReadSwr,
    useQueryConnectionsSwr,
    useQueryOfficeConversationUnreadSwr,
    useQueryOfficeRoomsSwr,
} from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { toOfficeRoom } from "@/modules/office"
import type { OfficeChannelWire, OfficeConversationUnread, OfficeRoom } from "@/modules/office"
import { useOfficeMarkers } from "./useOfficeMarkers"

const unreadOf = (entries: ReadonlyArray<{ readonly id: string; readonly unread: number }> | undefined) =>
    new Map((entries ?? []).map((entry) => [entry.id, entry.unread]))

/**
 * The Hub rooms and the direct conversations with the caller's unread counts, and the workspace channels the room panel
 * lists. `markConversationRead` records that the person read an agent's or a customer's conversation (opening it). Room unread
 * counts follow the persisted read cursor. Each room also carries the caller's side of it: the mute
 * and whether my last line was read (`markers`), and `isTypingHere` says someone types in the room on screen.
 */
export const useOfficeRooms = (selected: string | null, isTypingHere = false) => {
    const rooms = useQueryOfficeRoomsSwr()
    const unread = useQueryOfficeConversationUnreadSwr()
    const { markers, setMute } = useOfficeMarkers((rooms.data ?? []).map((room) => room.key ?? null))
    const connections = useQueryConnectionsSwr()
    const markConversation = useMutateMarkOfficeConversationReadSwr()
    const runGraphQL = useGraphQLWithToast()
    const { trigger: triggerConversation } = markConversation
    const { mutate } = rooms
    const { mutate: mutateUnread } = unread
    const list: ReadonlyArray<OfficeRoom> =
        rooms.data?.map((row) =>
            toOfficeRoom(row, markers.get(row.key ?? ""), isTypingHere && (row.key ?? null) === selected),
        ) ?? []
    const conversationUnread: OfficeConversationUnread = useMemo(
        () => ({ agents: unreadOf(unread.data?.agents), leads: unreadOf(unread.data?.leads) }),
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
    return { rooms: list, channels, unread: conversationUnread, markers, refreshRooms, markConversationRead, setMute }
}
