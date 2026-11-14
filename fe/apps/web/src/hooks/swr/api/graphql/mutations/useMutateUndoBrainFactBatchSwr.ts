"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateUndoBrainFactBatch,
    type MutateUndoBrainFactBatchRequest,
} from "@/modules/api/graphql/mutations/mutation-undo-brain-fact-batch"
import type { UndoBrainFactBatchMutation } from "@/modules/api"

/** What the UndoBrainFactBatch mutation is triggered with. */
interface UndoBrainFactBatchArg {
    readonly arg: MutateUndoBrainFactBatchRequest
}

/** The SWR key of the undoBrainFactBatch mutation. */
export const MUTATE_UNDO_BRAIN_FACT_BATCH_SWR_KEY = "MUTATE_UNDO_BRAIN_FACT_BATCH_SWR"

/** SWR mutation for {@link mutateUndoBrainFactBatch}: takes a batch of facts applied together back to review; answers how many went back and how many stayed. `trigger(input)` rejects with the back end failure. */
export const useMutateUndoBrainFactBatchSwr = (): SWRMutationResponse<
    UndoBrainFactBatchMutation["undoBrainFactBatch"],
    Error,
    typeof MUTATE_UNDO_BRAIN_FACT_BATCH_SWR_KEY,
    UndoBrainFactBatchArg["arg"]
> =>
    useSWRMutation(MUTATE_UNDO_BRAIN_FACT_BATCH_SWR_KEY, async (_key: string, { arg }: UndoBrainFactBatchArg) => {
        const result = await mutateUndoBrainFactBatch({ request: arg })
        if (!result.data) throw new Error("undoBrainFactBatch answered no data")
        return result.data.undoBrainFactBatch
    })
