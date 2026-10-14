"use client"

import useSWRMutation from "swr/mutation"
import { mutateRetryFailedStep } from "@/modules/api/graphql/mutations/mutation-retry-failed-step"
import type { MutateRetryFailedStepRequest } from "@/modules/api/graphql/mutations/mutation-retry-failed-step"

/** What the retryFailedStep mutation is triggered with. */
interface RetryFailedStepArg {
    readonly arg: MutateRetryFailedStepRequest
}

/** The SWR key of the retryFailedStep mutation. */
export const MUTATE_RETRY_FAILED_STEP_SWR_KEY = "MUTATE_RETRY_FAILED_STEP_SWR"

/** SWR mutation for {@link mutateRetryFailedStep}: `trigger(request)` answers the result and rejects with the back end failure. */
export const useMutateRetryFailedStepSwr = () =>
    useSWRMutation(MUTATE_RETRY_FAILED_STEP_SWR_KEY, async (_key: string, { arg }: RetryFailedStepArg) => {
        const result = await mutateRetryFailedStep({ request: arg })
        if (!result.data) throw new Error("retryFailedStep answered no data")
        return result.data.retryFailedStep
    })
