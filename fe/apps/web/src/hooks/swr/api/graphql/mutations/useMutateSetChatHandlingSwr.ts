"use client"

import { mutateSetChatHandling } from "@/modules/api/graphql/mutations/mutation-set-chat-handling"
import type { mutateSetChatHandling as MutateSetChatHandlingOperation } from "@/modules/api/graphql/mutations/mutation-set-chat-handling"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the setChatHandling mutation. */
export const MUTATE_SET_CHAT_HANDLING_SWR_KEY = "MUTATE_SET_CHAT_HANDLING_SWR"

/** SWR mutation for {@link mutateSetChatHandling}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSetChatHandlingSwr = () =>
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
