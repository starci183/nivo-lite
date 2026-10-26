"use client"

import useSWRMutation from "swr/mutation"
import { mutateMarkChatRead } from "@/modules/api/graphql/mutations/mutation-mark-chat-read"
import type { MutateMarkChatReadRequest } from "@/modules/api/graphql/mutations/mutation-mark-chat-read"

/** What the MarkChatRead mutation is triggered with. */
interface MarkChatReadArg {
    readonly arg: MutateMarkChatReadRequest
}

/** The SWR key of {@link useMutateMarkChatReadSwr}. */
export const MUTATE_MARK_CHAT_READ_SWR_KEY = "MUTATE_MARK_CHAT_READ_SWR"

/** SWR mutation for {@link mutateMarkChatRead}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateMarkChatReadSwr = () =>
    useSWRMutation(MUTATE_MARK_CHAT_READ_SWR_KEY, async (_key: string, { arg }: MarkChatReadArg) => {
        const result = await mutateMarkChatRead({ request: arg })
        if (!result.data) throw new Error("markChatRead answered no data")
        return result.data.markChatRead
    })
