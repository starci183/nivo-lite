"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import { useSWRConfig } from "swr"
import { matchesSwrKey } from "@/modules/utils"
import { QUERY_CHAT_ROOMS_SWR_KEY } from "../queries/useQueryChatRoomsSwr"
import { QUERY_CHAT_UNREAD_SWR_KEY } from "../queries/useQueryChatUnreadSwr"
import {
    mutateSendChatMessage,
    type mutateSendChatMessage as SendChatMessageOperation,
} from "@/modules/api/graphql/mutations/mutation-send-chat-message"
import type { SendChatMessageMutation } from "@/modules/api"

/** What the SendChatMessage mutation is triggered with. */
interface TriggerArg {
    readonly arg: SendChatMessageArg
}

/** The request of the SendChatMessage operation. */
type SendChatMessageArg = Parameters<typeof SendChatMessageOperation>[0]["request"]

/** The SWR identity of the SendChatMessage mutation. */
export const MUTATE_SEND_CHAT_MESSAGE_SWR_KEY = "MUTATE_SEND_CHAT_MESSAGE_SWR"

/** Sends a text message to a room, or to a member (the first send opens the direct room); a refusal comes back as data. The rooms and the unread counts are read again. */
export const useMutateSendChatMessageSwr = (
    workspaceId: string,
): SWRMutationResponse<SendChatMessageMutation["sendChatMessage"], Error, [string, string], SendChatMessageArg> => {
    const { mutate } = useSWRConfig()
    return useSWRMutation(
        [MUTATE_SEND_CHAT_MESSAGE_SWR_KEY, workspaceId],
        async ([, scope]: [string, string], { arg }: TriggerArg) => {
            const { data } = await mutateSendChatMessage({ request: arg, headers: { "X-Workspace-Id": scope } })
            if (!data) throw new Error("sendChatMessage answered no data")
            return data.sendChatMessage
        },
        {
            onSuccess: () => {
                void mutate(matchesSwrKey(QUERY_CHAT_ROOMS_SWR_KEY))
                void mutate(matchesSwrKey(QUERY_CHAT_UNREAD_SWR_KEY))
            },
        },
    )
}
