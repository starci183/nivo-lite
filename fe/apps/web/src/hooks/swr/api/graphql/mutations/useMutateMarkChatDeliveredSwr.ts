"use client"

import useSWRMutation from "swr/mutation"
import { mutateMarkChatDelivered } from "@/modules/api/graphql/mutations/mutation-mark-chat-delivered"
import type { MutateMarkChatDeliveredRequest } from "@/modules/api/graphql/mutations/mutation-mark-chat-delivered"

/** What the MarkChatDelivered mutation is triggered with. */
interface MarkChatDeliveredArg {
    readonly arg: MutateMarkChatDeliveredRequest
}

/** The SWR key of {@link useMutateMarkChatDeliveredSwr}. */
export const MUTATE_MARK_CHAT_DELIVERED_SWR_KEY = "MUTATE_MARK_CHAT_DELIVERED_SWR"

/** SWR mutation for {@link mutateMarkChatDelivered}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateMarkChatDeliveredSwr = () =>
    useSWRMutation(MUTATE_MARK_CHAT_DELIVERED_SWR_KEY, async (_key: string, { arg }: MarkChatDeliveredArg) => {
        const result = await mutateMarkChatDelivered({ request: arg })
        if (!result.data) throw new Error("markChatDelivered answered no data")
        return result.data.markChatDelivered
    })
