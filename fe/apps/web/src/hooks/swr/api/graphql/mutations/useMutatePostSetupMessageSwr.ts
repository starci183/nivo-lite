"use client"

import useSWRMutation from "swr/mutation"
import { mutatePostSetupMessage } from "@/modules/api/graphql/mutations/mutation-post-setup-message"
import type { MutatePostSetupMessageRequest } from "@/modules/api/graphql/mutations/mutation-post-setup-message"

/** What the PostSetupMessage mutation is triggered with. */
interface PostSetupMessageArg {
    readonly arg: MutatePostSetupMessageRequest
}

/** The SWR key of {@link useMutatePostSetupMessageSwr}. */
export const MUTATE_POST_SETUP_MESSAGE_SWR_KEY = "MUTATE_POST_SETUP_MESSAGE_SWR"

/** SWR mutation for {@link mutatePostSetupMessage}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutatePostSetupMessageSwr = () =>
    useSWRMutation(MUTATE_POST_SETUP_MESSAGE_SWR_KEY, async (_key: string, { arg }: PostSetupMessageArg) => {
        const result = await mutatePostSetupMessage({ request: arg })
        if (!result.data) throw new Error("postSetupMessage answered no data")
        return result.data.postSetupMessage
    })
