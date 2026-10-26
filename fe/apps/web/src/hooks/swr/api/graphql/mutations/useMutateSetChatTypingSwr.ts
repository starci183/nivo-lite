"use client"

import useSWRMutation from "swr/mutation"
import { mutateSetChatTyping } from "@/modules/api/graphql/mutations/mutation-set-chat-typing"
import type { MutateSetChatTypingRequest } from "@/modules/api/graphql/mutations/mutation-set-chat-typing"

/** What the SetChatTyping mutation is triggered with. */
interface SetChatTypingArg {
    readonly arg: MutateSetChatTypingRequest
}

/** The SWR key of {@link useMutateSetChatTypingSwr}. */
export const MUTATE_SET_CHAT_TYPING_SWR_KEY = "MUTATE_SET_CHAT_TYPING_SWR"

/** SWR mutation for {@link mutateSetChatTyping}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateSetChatTypingSwr = () =>
    useSWRMutation(MUTATE_SET_CHAT_TYPING_SWR_KEY, async (_key: string, { arg }: SetChatTypingArg) => {
        const result = await mutateSetChatTyping({ request: arg })
        if (!result.data) throw new Error("setChatTyping answered no data")
        return result.data.setChatTyping
    })
