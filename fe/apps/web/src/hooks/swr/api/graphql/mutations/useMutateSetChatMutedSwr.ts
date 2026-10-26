"use client"

import useSWRMutation from "swr/mutation"
import { mutateSetChatMuted } from "@/modules/api/graphql/mutations/mutation-set-chat-muted"
import type { MutateSetChatMutedRequest } from "@/modules/api/graphql/mutations/mutation-set-chat-muted"

/** What the SetChatMuted mutation is triggered with. */
interface SetChatMutedArg {
    readonly arg: MutateSetChatMutedRequest
}

/** The SWR key of {@link useMutateSetChatMutedSwr}. */
export const MUTATE_SET_CHAT_MUTED_SWR_KEY = "MUTATE_SET_CHAT_MUTED_SWR"

/** SWR mutation for {@link mutateSetChatMuted}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateSetChatMutedSwr = () =>
    useSWRMutation(MUTATE_SET_CHAT_MUTED_SWR_KEY, async (_key: string, { arg }: SetChatMutedArg) => {
        const result = await mutateSetChatMuted({ request: arg })
        if (!result.data) throw new Error("setChatMuted answered no data")
        return result.data.setChatMuted
    })
