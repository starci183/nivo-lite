"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateUnpinChatMessage,
    type mutateUnpinChatMessage as UnpinChatMessageOperation,
} from "@/modules/api/graphql/mutations/mutation-unpin-chat-message"
import type { SWRMutationResponse } from "swr/mutation"
import type { UnpinChatMessageMutation } from "@/modules/api"

/** What the UnpinChatMessage mutation is triggered with. */
interface TriggerArg {
    readonly arg: UnpinChatMessageArg
}

/** The request of the UnpinChatMessage operation. */
type UnpinChatMessageArg = Parameters<typeof UnpinChatMessageOperation>[0]["request"]

/** The SWR identity of the UnpinChatMessage mutation. */
export const MUTATE_UNPIN_CHAT_MESSAGE_SWR_KEY = "MUTATE_UNPIN_CHAT_MESSAGE_SWR"

/** Takes the pin off a message of a room. Nothing is cached or read again. */
export const useMutateUnpinChatMessageSwr = (
    workspaceId: string,
): SWRMutationResponse<
    UnpinChatMessageMutation["unpinChatMessage"] | null,
    Error,
    [string, string],
    UnpinChatMessageArg
> =>
    useSWRMutation(
        [MUTATE_UNPIN_CHAT_MESSAGE_SWR_KEY, workspaceId],
        async ([, scope]: [string, string], { arg }: TriggerArg) => {
            const { data } = await mutateUnpinChatMessage({ request: arg, headers: { "X-Workspace-Id": scope } })
            return data?.unpinChatMessage ?? null
        },
    )
