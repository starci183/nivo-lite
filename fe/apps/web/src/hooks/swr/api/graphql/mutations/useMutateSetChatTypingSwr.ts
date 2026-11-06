"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateSetChatTyping,
    type mutateSetChatTyping as SetChatTypingOperation,
} from "@/modules/api/graphql/mutations/mutation-set-chat-typing"
import type { SWRMutationResponse } from "swr/mutation"
import type { SetChatTypingMutation } from "@/modules/api"

/** What the SetChatTyping mutation is triggered with. */
interface TriggerArg {
    readonly arg: SetChatTypingArg
}

/** The request of the SetChatTyping operation. */
type SetChatTypingArg = Parameters<typeof SetChatTypingOperation>[0]["request"]

/** The SWR identity of the SetChatTyping mutation. */
export const MUTATE_SET_CHAT_TYPING_SWR_KEY = "MUTATE_SET_CHAT_TYPING_SWR"

/** Tells the other members of a room that the viewer is typing, or that they stopped; undefined when the door answered nothing. Nothing is cached. */
export const useMutateSetChatTypingSwr = (
    workspaceId: string,
): SWRMutationResponse<SetChatTypingMutation["setChatTyping"] | undefined, Error, [string, string], SetChatTypingArg> =>
    useSWRMutation([MUTATE_SET_CHAT_TYPING_SWR_KEY, workspaceId], ([, scope]: [string, string], { arg }: TriggerArg) =>
        mutateSetChatTyping({ request: arg, headers: { "X-Workspace-Id": scope } }).then(
            (result) => result.data?.setChatTyping,
        ),
    )
