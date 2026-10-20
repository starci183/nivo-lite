"use client"

import { useCallback } from "react"
import { useMutateMarkOfficeRoomReadSwr, useQueryConnectionsSwr, useQueryOfficeRoomsSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { OFFICE_POLL_MS, toOfficeRoom } from "@/modules/office"
import type { OfficeChannelWire, OfficeRoom } from "@/modules/office"

const LIVE = { refreshInterval: OFFICE_POLL_MS }

/**
 * The Hub rooms with the caller's unread counts, and the workspace channels the room panel lists. `markRead` records that the
 * person read a room (opening it, writing in it); the room on screen never shows a badge.
 */
export const useOfficeRooms = (selected: string | null) => {
    const rooms = useQueryOfficeRoomsSwr(LIVE)
    const connections = useQueryConnectionsSwr()
    const markRoom = useMutateMarkOfficeRoomReadSwr()
    const runGraphQL = useGraphQLWithToast()
    const { trigger } = markRoom
    const { mutate } = rooms
    const list: ReadonlyArray<OfficeRoom> = (rooms.data?.map(toOfficeRoom) ?? []).map((room) =>
        room.key === selected ? { ...room, unread: 0 } : room,
    )
    const markRead = useCallback(
        async (room: string | null) => {
            const done = await runGraphQL(() => trigger({ room }), { showSuccessToast: false })
            if (done !== undefined) await mutate()
        },
        [runGraphQL, trigger, mutate],
    )
    const channels: ReadonlyArray<OfficeChannelWire> = (connections.data ?? []).map((connection) => ({
        id: connection.id,
        provider: connection.provider,
        name: connection.name,
        status: connection.status,
        agentIds: connection.agentIds,
    }))
    return { rooms: list, channels, markRead }
}
