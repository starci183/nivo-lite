"use client"

import useSWRMutation from "swr/mutation"
import { mutatePostThreadMessage } from "@/modules/api/graphql/mutations/mutation-post-thread-message"
import type { MutatePostThreadMessageRequest } from "@/modules/api/graphql/mutations/mutation-post-thread-message"

/** What the PostThreadMessage mutation is triggered with. */
interface PostThreadMessageArg {
    readonly arg: MutatePostThreadMessageRequest
}

/** The SWR key of {@link useMutatePostThreadMessageSwr}. */
export const MUTATE_POST_THREAD_MESSAGE_SWR_KEY = "MUTATE_POST_THREAD_MESSAGE_SWR"

/** SWR mutation for {@link mutatePostThreadMessage}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutatePostThreadMessageSwr = () =>
    useSWRMutation(MUTATE_POST_THREAD_MESSAGE_SWR_KEY, async (_key: string, { arg }: PostThreadMessageArg) => {
        const result = await mutatePostThreadMessage({ request: arg })
        if (!result.data) throw new Error("postThreadMessage answered no data")
        return result.data.postThreadMessage
    })
