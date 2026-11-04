"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateDecideExecution,
    type MutateDecideExecutionRequest,
} from "@/modules/api/graphql/mutations/mutation-decide-execution"
import type { SWRMutationResponse } from "swr/mutation"
import type { DecideExecutionMutation } from "@/modules/api"

/** What the DecideExecution mutation is triggered with. */
interface DecideExecutionArg {
    readonly arg: MutateDecideExecutionRequest
}

/** The SWR key of {@link useMutateDecideExecutionSwr}. */
export const MUTATE_DECIDE_EXECUTION_SWR_KEY = "MUTATE_DECIDE_EXECUTION_SWR"

/** SWR mutation for {@link mutateDecideExecution}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateDecideExecutionSwr = (): SWRMutationResponse<
    DecideExecutionMutation["decideExecution"],
    Error,
    typeof MUTATE_DECIDE_EXECUTION_SWR_KEY,
    DecideExecutionArg["arg"]
> =>
    useSWRMutation(MUTATE_DECIDE_EXECUTION_SWR_KEY, async (_key: string, { arg }: DecideExecutionArg) => {
        const result = await mutateDecideExecution({ request: arg })
        if (!result.data) throw new Error("decideExecution answered no data")
        return result.data.decideExecution
    })
