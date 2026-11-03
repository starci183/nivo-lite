"use client"

import {
    mutateSetChatHandling,
    type mutateSetChatHandling as MutateSetChatHandlingOperation,
} from "@/modules/api/graphql/mutations/mutation-set-chat-handling"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"
import type { SWRMutationResponse } from "swr/mutation"
import type { SetChatHandlingMutation } from "@/modules/api"

/** The SWR key of the setChatHandling mutation. */
export const MUTATE_SET_CHAT_HANDLING_SWR_KEY = "MUTATE_SET_CHAT_HANDLING_SWR"

/** SWR mutation for {@link mutateSetChatHandling}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSetChatHandlingSwr = (): SWRMutationResponse<
    SetChatHandlingMutation["setChatHandling"],
    Error,
    typeof MUTATE_SET_CHAT_HANDLING_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_SET_CHAT_HANDLING_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSetChatHandling({ request: arg }), MUTATE_SET_CHAT_HANDLING_SWR_KEY)
                .setChatHandling,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateSetChatHandlingOperation>[0]["request"]
}
