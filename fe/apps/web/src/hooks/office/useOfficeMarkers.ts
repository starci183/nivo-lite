"use client"

import { useCallback, useMemo } from "react"
import { useMutateSetChatMutedSwr, useQueryChatMarkerStateSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { OFFICE_SAFETY_POLL_MS, chatTargetOf } from "@/modules/office"
import type { ChatMarkerWire } from "@/modules/office"

/** The Hub room keys whose state is asked: a null key is the Office room. */
type RoomKeys = ReadonlyArray<string | null>

/**
 * The caller's side of each Hub room: the mute and the read of my last line, by room key ("" is the Office room), kept current by
 * the office-activity stream, and `setMute` to change the mute of one room.
 */
export const useOfficeMarkers = (keys: RoomKeys) => {
    const states = useQueryChatMarkerStateSwr(keys.map(chatTargetOf), { refreshInterval: OFFICE_SAFETY_POLL_MS })
    const { trigger } = useMutateSetChatMutedSwr()
    const runGraphQL = useGraphQLWithToast()
    const { mutate } = states
    const markers: ReadonlyMap<string, ChatMarkerWire | undefined> = useMemo(
        () => new Map((states.data ?? []).map((answer) => [answer.request.room ?? "", answer.state])),
        [states.data],
    )
    const setMute = useCallback(
        async (room: string | null, muted: boolean) => {
            const done = await runGraphQL(() => trigger({ ...chatTargetOf(room), muted }), { showSuccessToast: false })
            if (done !== undefined) await mutate()
        },
        [runGraphQL, trigger, mutate],
    )
    return { markers, setMute }
}
