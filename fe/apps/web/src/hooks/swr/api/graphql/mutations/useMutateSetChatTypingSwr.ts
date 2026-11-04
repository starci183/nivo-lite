"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateSetChatTyping,
    type MutateSetChatTypingRequest,
} from "@/modules/api/graphql/mutations/mutation-set-chat-typing"
import type { SWRMutationResponse } from "swr/mutation"
import type { SetChatTypingMutation } from "@/modules/api"

/** What the SetChatTyping mutation is triggered with. */
interface SetChatTypingArg {
    readonly arg: MutateSetChatTypingRequest
}

/** The SWR key of {@link useMutateSetChatTypingSwr}. */
export const MUTATE_SET_CHAT_TYPING_SWR_KEY = "MUTATE_SET_CHAT_TYPING_SWR"

/** SWR mutation for {@link mutateSetChatTyping}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateSetChatTypingSwr = (): SWRMutationResponse<
    SetChatTypingMutation["setChatTyping"],
    Error,
    typeof MUTATE_SET_CHAT_TYPING_SWR_KEY,
    SetChatTypingArg["arg"]
> =>
    useSWRMutation(MUTATE_SET_CHAT_TYPING_SWR_KEY, async (_key: string, { arg }: SetChatTypingArg) => {
        const result = await mutateSetChatTyping({ request: arg })
        if (!result.data) throw new Error("setChatTyping answered no data")
        return result.data.setChatTyping
    })
