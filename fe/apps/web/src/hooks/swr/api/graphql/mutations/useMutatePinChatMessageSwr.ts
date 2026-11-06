"use client"

import useSWRMutation from "swr/mutation"
import {
    mutatePinChatMessage,
    type mutatePinChatMessage as PinChatMessageOperation,
} from "@/modules/api/graphql/mutations/mutation-pin-chat-message"
import type { SWRMutationResponse } from "swr/mutation"
import type { PinChatMessageMutation } from "@/modules/api"

/** What the PinChatMessage mutation is triggered with. */
interface TriggerArg {
    readonly arg: PinChatMessageArg
}

/** The request of the PinChatMessage operation. */
type PinChatMessageArg = Parameters<typeof PinChatMessageOperation>[0]["request"]

/** The SWR identity of the PinChatMessage mutation. */
export const MUTATE_PIN_CHAT_MESSAGE_SWR_KEY = "MUTATE_PIN_CHAT_MESSAGE_SWR"

/** Pins a message of a room. Nothing is cached or read again. */
export const useMutatePinChatMessageSwr = (
    workspaceId: string,
): SWRMutationResponse<PinChatMessageMutation["pinChatMessage"], Error, [string, string], PinChatMessageArg> =>
    useSWRMutation(
        [MUTATE_PIN_CHAT_MESSAGE_SWR_KEY, workspaceId],
        async ([, scope]: [string, string], { arg }: TriggerArg) => {
            const { data } = await mutatePinChatMessage({ request: arg, headers: { "X-Workspace-Id": scope } })
            if (!data) throw new Error("pinChatMessage answered no data")
            return data.pinChatMessage
        },
    )
