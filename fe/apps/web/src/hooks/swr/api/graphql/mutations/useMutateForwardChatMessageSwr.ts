"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateForwardChatMessage,
    type mutateForwardChatMessage as ForwardChatMessageOperation,
} from "@/modules/api/graphql/mutations/mutation-forward-chat-message"
import type { ForwardChatMessageMutation } from "@/modules/api"

/** What the ForwardChatMessage mutation is triggered with. */
interface TriggerArg {
    readonly arg: ForwardChatMessageArg
}

/** The request of the ForwardChatMessage operation. */
type ForwardChatMessageArg = Parameters<typeof ForwardChatMessageOperation>[0]["request"]

/** The SWR identity of the ForwardChatMessage mutation. */
export const MUTATE_FORWARD_CHAT_MESSAGE_SWR_KEY = "MUTATE_FORWARD_CHAT_MESSAGE_SWR"

/** Forwards a message into another room. A refusal comes back as data. */
export const useMutateForwardChatMessageSwr = (
    workspaceId: string,
): SWRMutationResponse<ForwardChatMessageMutation["forwardChatMessage"], Error, [string, string], ForwardChatMessageArg> =>
    useSWRMutation(
        [MUTATE_FORWARD_CHAT_MESSAGE_SWR_KEY, workspaceId],
        async ([, scope]: [string, string], { arg }: TriggerArg) => {
            const { data } = await mutateForwardChatMessage({ request: arg, headers: { "X-Workspace-Id": scope } })
            if (!data) throw new Error("forwardChatMessage answered no data")
            return data.forwardChatMessage
        },
    )
