"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import { useSWRConfig } from "swr"
import { matchesSwrKey } from "@/modules/utils"
import { QUERY_CHAT_ROOMS_SWR_KEY } from "../queries/useQueryChatRoomsSwr"
import {
    mutateCreateChatRoom,
    type mutateCreateChatRoom as CreateChatRoomOperation,
} from "@/modules/api/graphql/mutations/mutation-create-chat-room"
import type { CreateChatRoomMutation } from "@/modules/api"

/** What the CreateChatRoom mutation is triggered with. */
interface TriggerArg {
    readonly arg: CreateChatRoomArg
}

/** The request of the CreateChatRoom operation. */
type CreateChatRoomArg = Parameters<typeof CreateChatRoomOperation>[0]["request"]

/** The SWR identity of the CreateChatRoom mutation. */
export const MUTATE_CREATE_CHAT_ROOM_SWR_KEY = "MUTATE_CREATE_CHAT_ROOM_SWR"

/** Opens a direct room (idempotent per pair) or a group room; a refusal comes back as data. The rooms are read again. */
export const useMutateCreateChatRoomSwr = (
    workspaceId: string,
): SWRMutationResponse<CreateChatRoomMutation["createChatRoom"], Error, [string, string], CreateChatRoomArg> => {
    const { mutate } = useSWRConfig()
    return useSWRMutation(
        [MUTATE_CREATE_CHAT_ROOM_SWR_KEY, workspaceId],
        async ([, scope]: [string, string], { arg }: TriggerArg) => {
            const result = await mutateCreateChatRoom({ request: arg, headers: { "X-Workspace-Id": scope } })
            if (!result.data) throw new Error("createChatRoom answered no data")
            return result.data.createChatRoom
        },
        {
            onSuccess: () => {
                void mutate(matchesSwrKey(QUERY_CHAT_ROOMS_SWR_KEY))
            },
        },
    )
}
