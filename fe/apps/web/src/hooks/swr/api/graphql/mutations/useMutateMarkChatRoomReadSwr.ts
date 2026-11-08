"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import { useSWRConfig } from "swr"
import { matchesSwrKey } from "@/modules/utils"
import { QUERY_CHAT_ROOMS_SWR_KEY } from "../queries/useQueryChatRoomsSwr"
import { QUERY_CHAT_UNREAD_SWR_KEY } from "../queries/useQueryChatUnreadSwr"
import { answeredData } from "@/hooks/workspaceread"
import {
    mutateMarkChatRoomRead,
    type mutateMarkChatRoomRead as MarkChatRoomReadOperation,
} from "@/modules/api/graphql/mutations/mutation-mark-chat-room-read"
import type { MarkChatRoomReadMutation } from "@/modules/api"

/** What the MarkChatRoomRead mutation is triggered with. */
interface TriggerArg {
    readonly arg: MarkChatRoomReadArg
}

/** The request of the MarkChatRoomRead operation. */
type MarkChatRoomReadArg = Parameters<typeof MarkChatRoomReadOperation>[0]["request"]

/** The SWR identity of the MarkChatRoomRead mutation. */
export const MUTATE_MARK_CHAT_ROOM_READ_SWR_KEY = "MUTATE_MARK_CHAT_ROOM_READ_SWR"

/** Marks a room read up to its newest message; the rooms and the unread counts are read again. */
export const useMutateMarkChatRoomReadSwr = (
    workspaceId: string,
): SWRMutationResponse<MarkChatRoomReadMutation["markChatRoomRead"], Error, [string, string], MarkChatRoomReadArg> => {
    const { mutate } = useSWRConfig()
    return useSWRMutation(
        [MUTATE_MARK_CHAT_ROOM_READ_SWR_KEY, workspaceId],
        async ([, scope]: [string, string], { arg }: TriggerArg) =>
            answeredData(
                await mutateMarkChatRoomRead({ request: arg, headers: { "X-Workspace-Id": scope } }),
                "markChatRoomRead",
            ).markChatRoomRead,
        {
            onSuccess: () => {
                void mutate(matchesSwrKey(QUERY_CHAT_ROOMS_SWR_KEY))
                void mutate(matchesSwrKey(QUERY_CHAT_UNREAD_SWR_KEY))
            },
        },
    )
}
