"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateRetryFailedStep,
    type MutateRetryFailedStepRequest,
} from "@/modules/api/graphql/mutations/mutation-retry-failed-step"
import type { SWRMutationResponse } from "swr/mutation"
import type { RetryFailedStepMutation } from "@/modules/api"

/** What the retryFailedStep mutation is triggered with. */
interface RetryFailedStepArg {
    readonly arg: MutateRetryFailedStepRequest
}

/** The SWR key of the retryFailedStep mutation. */
export const MUTATE_RETRY_FAILED_STEP_SWR_KEY = "MUTATE_RETRY_FAILED_STEP_SWR"

/** SWR mutation for {@link mutateRetryFailedStep}: `trigger(request)` answers the result and rejects with the back end failure. */
export const useMutateRetryFailedStepSwr = (): SWRMutationResponse<
    RetryFailedStepMutation["retryFailedStep"],
    Error,
    typeof MUTATE_RETRY_FAILED_STEP_SWR_KEY,
    RetryFailedStepArg["arg"]
> =>
    useSWRMutation(MUTATE_RETRY_FAILED_STEP_SWR_KEY, async (_key: string, { arg }: RetryFailedStepArg) => {
        const result = await mutateRetryFailedStep({ request: arg })
        if (!result.data) throw new Error("retryFailedStep answered no data")
        return result.data.retryFailedStep
    })
