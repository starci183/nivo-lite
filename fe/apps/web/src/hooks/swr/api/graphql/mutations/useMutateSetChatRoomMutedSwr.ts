"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import { useSWRConfig } from "swr"
import { matchesSwrKey } from "@/modules/utils"
import { QUERY_CHAT_ROOMS_SWR_KEY } from "../queries/useQueryChatRoomsSwr"
import { QUERY_CHAT_UNREAD_SWR_KEY } from "../queries/useQueryChatUnreadSwr"
import {
    mutateSetChatRoomMuted,
    type mutateSetChatRoomMuted as SetChatRoomMutedOperation,
} from "@/modules/api/graphql/mutations/mutation-set-chat-room-muted"
import type { SetChatRoomMutedMutation } from "@/modules/api"

/** What the SetChatRoomMuted mutation is triggered with. */
interface TriggerArg {
    readonly arg: SetChatRoomMutedArg
}

/** The request of the SetChatRoomMuted operation. */
type SetChatRoomMutedArg = Parameters<typeof SetChatRoomMutedOperation>[0]["request"]

/** The SWR identity of the SetChatRoomMuted mutation. */
export const MUTATE_SET_CHAT_ROOM_MUTED_SWR_KEY = "MUTATE_SET_CHAT_ROOM_MUTED_SWR"

/** Mutes or unmutes a room for the viewer; the rooms and the unread counts are read again. Null when the door answered nothing. */
export const useMutateSetChatRoomMutedSwr = (
    workspaceId: string,
): SWRMutationResponse<
    SetChatRoomMutedMutation["setChatRoomMuted"] | null,
    Error,
    [string, string],
    SetChatRoomMutedArg
> => {
    const { mutate } = useSWRConfig()
    return useSWRMutation(
        [MUTATE_SET_CHAT_ROOM_MUTED_SWR_KEY, workspaceId],
        async ([, scope]: [string, string], { arg }: TriggerArg) => {
            const { data } = await mutateSetChatRoomMuted({ request: arg, headers: { "X-Workspace-Id": scope } })
            return data?.setChatRoomMuted ?? null
        },
        {
            onSuccess: () => {
                void mutate(matchesSwrKey(QUERY_CHAT_ROOMS_SWR_KEY))
                void mutate(matchesSwrKey(QUERY_CHAT_UNREAD_SWR_KEY))
            },
        },
    )
}
