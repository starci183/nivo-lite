"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateSetBrainPolicy,
    type MutateSetBrainPolicyRequest,
} from "@/modules/api/graphql/mutations/mutation-set-brain-policy"
import type { SetBrainPolicyMutation } from "@/modules/api"

/** What the SetBrainPolicy mutation is triggered with. */
interface SetBrainPolicyArg {
    readonly arg: MutateSetBrainPolicyRequest
}

/** The SWR key of the setBrainPolicy mutation. */
export const MUTATE_SET_BRAIN_POLICY_SWR_KEY = "MUTATE_SET_BRAIN_POLICY_SWR"

/** SWR mutation for {@link mutateSetBrainPolicy}. `trigger(input)` answers the outcome, or rejects with the back end failure. */
export const useMutateSetBrainPolicySwr = (): SWRMutationResponse<
    SetBrainPolicyMutation["setBrainPolicy"],
    Error,
    typeof MUTATE_SET_BRAIN_POLICY_SWR_KEY,
    SetBrainPolicyArg["arg"]
> =>
    useSWRMutation(MUTATE_SET_BRAIN_POLICY_SWR_KEY, async (_key: string, { arg }: SetBrainPolicyArg) => {
        const result = await mutateSetBrainPolicy({ request: arg })
        if (!result.data) throw new Error("setBrainPolicy answered no data")
        return result.data.setBrainPolicy
    })
