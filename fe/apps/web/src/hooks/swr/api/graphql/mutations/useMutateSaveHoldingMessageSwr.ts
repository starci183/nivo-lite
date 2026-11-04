"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateSaveHoldingMessage,
    type MutateSaveHoldingMessageRequest,
} from "@/modules/api/graphql/mutations/mutation-save-holding-message"
import type { SWRMutationResponse } from "swr/mutation"
import type { SaveHoldingMessageMutation } from "@/modules/api"

/** What the SaveHoldingMessage mutation is triggered with. */
interface SaveHoldingMessageArg {
    readonly arg: MutateSaveHoldingMessageRequest
}

/** The SWR key of {@link useMutateSaveHoldingMessageSwr}. */
export const MUTATE_SAVE_HOLDING_MESSAGE_SWR_KEY = "MUTATE_SAVE_HOLDING_MESSAGE_SWR"

/** SWR mutation for {@link mutateSaveHoldingMessage}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateSaveHoldingMessageSwr = (): SWRMutationResponse<
    SaveHoldingMessageMutation["saveHoldingMessage"],
    Error,
    typeof MUTATE_SAVE_HOLDING_MESSAGE_SWR_KEY,
    SaveHoldingMessageArg["arg"]
> =>
    useSWRMutation(MUTATE_SAVE_HOLDING_MESSAGE_SWR_KEY, async (_key: string, { arg }: SaveHoldingMessageArg) => {
        const result = await mutateSaveHoldingMessage({ request: arg })
        if (!result.data) throw new Error("saveHoldingMessage answered no data")
        return result.data.saveHoldingMessage
    })
