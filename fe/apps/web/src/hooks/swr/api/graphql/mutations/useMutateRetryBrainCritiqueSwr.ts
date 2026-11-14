"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateRetryBrainCritique,
    type MutateRetryBrainCritiqueRequest,
} from "@/modules/api/graphql/mutations/mutation-retry-brain-critique"
import type { RetryBrainCritiqueMutation } from "@/modules/api"

/** What the RetryBrainCritique mutation is triggered with. */
interface RetryBrainCritiqueArg {
    readonly arg: MutateRetryBrainCritiqueRequest
}

/** The SWR key of the retryBrainCritique mutation. */
export const MUTATE_RETRY_BRAIN_CRITIQUE_SWR_KEY = "MUTATE_RETRY_BRAIN_CRITIQUE_SWR"

/** SWR mutation for {@link mutateRetryBrainCritique}: Asks the document critic to read a document again. `trigger(input)` rejects with the back end failure. */
export const useMutateRetryBrainCritiqueSwr = (): SWRMutationResponse<
    RetryBrainCritiqueMutation["retryBrainCritique"],
    Error,
    typeof MUTATE_RETRY_BRAIN_CRITIQUE_SWR_KEY,
    RetryBrainCritiqueArg["arg"]
> =>
    useSWRMutation(MUTATE_RETRY_BRAIN_CRITIQUE_SWR_KEY, async (_key: string, { arg }: RetryBrainCritiqueArg) => {
        const result = await mutateRetryBrainCritique({ request: arg })
        if (!result.data) throw new Error("retryBrainCritique answered no data")
        return result.data.retryBrainCritique
    })
