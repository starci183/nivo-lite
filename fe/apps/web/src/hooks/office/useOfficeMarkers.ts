"use client"

import { useCallback, useMemo } from "react"
import { useMutateSetChatMutedSwr, useQueryChatMarkerStateSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { chatTargetOf } from "@/modules/office"
import type { ChatMarkerWire } from "@/modules/office"

import type { SWRResponse, SWRConfiguration } from "swr"
import type { ChatMarkerStateAnswer } from "@/hooks/swr/api/graphql/queries/useQueryChatMarkerStateSwr"

/** The Hub room keys whose state is asked: a null key is the Office room. */
type RoomKeys = ReadonlyArray<string | null>

type UseOfficeMarkersResult = {
    read: SWRResponse<
        readonly ChatMarkerStateAnswer[],
        unknown,
        SWRConfiguration<readonly ChatMarkerStateAnswer[]> | undefined
    >
    markers: ReadonlyMap<string, ChatMarkerWire | undefined>
    setMute: (room: string | null, muted: boolean) => Promise<void>
    isLoading: boolean
    error: unknown
}

/**
 * The caller's side of each Hub room: the mute and the read of my last line, by room key ("" is the Office room), kept current by
 * the office-activity stream, and `setMute` to change the mute of one room.
 */
export const useOfficeMarkers = (keys: RoomKeys): UseOfficeMarkersResult => {
    const states = useQueryChatMarkerStateSwr(keys.map(chatTargetOf))
    const { trigger } = useMutateSetChatMutedSwr()
    const runGraphQL = useGraphQLWithToast()
    const { mutate } = states
    const markers: ReadonlyMap<string, ChatMarkerWire | undefined> = useMemo(
        () =>
            states.data === undefined
                ? new Map<string, ChatMarkerWire | undefined>()
                : new Map(states.data.map((answer) => [answer.request.room ?? "", answer.state])),
        [states.data],
    )
    const setMute = useCallback(
        async (room: string | null, muted: boolean): Promise<void> => {
            const done = await runGraphQL(() => trigger({ ...chatTargetOf(room), muted }), { showSuccessToast: false })
            if (done !== undefined) await mutate()
        },
        [runGraphQL, trigger, mutate],
    )
    const error: unknown = states.error
    return { read: states, markers, setMute, isLoading: states.isLoading, error }
}
