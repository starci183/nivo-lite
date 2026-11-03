"use client"

import useSWRMutation from "swr/mutation"
import { mutateSaveReplyTimeout } from "@/modules/api/graphql/mutations/mutation-save-reply-timeout"
import type { MutateSaveReplyTimeoutRequest } from "@/modules/api/graphql/mutations/mutation-save-reply-timeout"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** What the SaveReplyTimeout mutation is triggered with. */
interface SaveReplyTimeoutArg {
    readonly arg: MutateSaveReplyTimeoutRequest
}

/** The SWR key of {@link useMutateSaveReplyTimeoutSwr}. */
export const MUTATE_SAVE_REPLY_TIMEOUT_SWR_KEY = "MUTATE_SAVE_REPLY_TIMEOUT_SWR"

/** SWR mutation for {@link mutateSaveReplyTimeout}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateSaveReplyTimeoutSwr = (): SWRMutationResponse<
    OperationData<typeof mutateSaveReplyTimeout>["saveReplyTimeout"],
    Error,
    typeof MUTATE_SAVE_REPLY_TIMEOUT_SWR_KEY,
    SaveReplyTimeoutArg["arg"]
> =>
    useSWRMutation(MUTATE_SAVE_REPLY_TIMEOUT_SWR_KEY, async (_key: string, { arg }: SaveReplyTimeoutArg) => {
        const result = await mutateSaveReplyTimeout({ request: arg })
        if (!result.data) throw new Error("saveReplyTimeout answered no data")
        return result.data.saveReplyTimeout
    })
