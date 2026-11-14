"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateReactToChatMessage,
    type mutateReactToChatMessage as ReactToChatMessageOperation,
} from "@/modules/api/graphql/mutations/mutation-react-to-chat-message"
import type { ReactToChatMessageMutation } from "@/modules/api"

/** What the ReactToChatMessage mutation is triggered with. */
interface TriggerArg {
    readonly arg: ReactToChatMessageArg
}

/** The request of the ReactToChatMessage operation. */
type ReactToChatMessageArg = Parameters<typeof ReactToChatMessageOperation>[0]["request"]

/** The SWR identity of the ReactToChatMessage mutation. */
export const MUTATE_REACT_TO_CHAT_MESSAGE_SWR_KEY = "MUTATE_REACT_TO_CHAT_MESSAGE_SWR"

/** Adds taps of one emoji to a message. Nothing is cached or read again: the thread follows by its own poll. */
export const useMutateReactToChatMessageSwr = (
    workspaceId: string,
): SWRMutationResponse<ReactToChatMessageMutation["reactToChatMessage"], Error, [string, string], ReactToChatMessageArg> =>
    useSWRMutation(
        [MUTATE_REACT_TO_CHAT_MESSAGE_SWR_KEY, workspaceId],
        async ([, scope]: [string, string], { arg }: TriggerArg) => {
            const { data } = await mutateReactToChatMessage({ request: arg, headers: { "X-Workspace-Id": scope } })
            if (!data) throw new Error("reactToChatMessage answered no data")
            return data.reactToChatMessage
        },
    )
