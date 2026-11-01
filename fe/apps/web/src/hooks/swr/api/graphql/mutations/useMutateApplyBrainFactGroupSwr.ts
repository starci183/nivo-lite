"use client"

import useSWRMutation from "swr/mutation"
import { mutateApplyBrainFactGroup } from "@/modules/api/graphql/mutations/mutation-apply-brain-fact-group"
import type { MutateApplyBrainFactGroupRequest } from "@/modules/api/graphql/mutations/mutation-apply-brain-fact-group"

/** What the ApplyBrainFactGroup mutation is triggered with. */
interface ApplyBrainFactGroupArg {
    readonly arg: MutateApplyBrainFactGroupRequest
}

/** The SWR key of the applyBrainFactGroup mutation. */
export const MUTATE_APPLY_BRAIN_FACT_GROUP_SWR_KEY = "MUTATE_APPLY_BRAIN_FACT_GROUP_SWR"

/** SWR mutation for {@link mutateApplyBrainFactGroup}: applies the checked facts of one internal document together; answers the batch, how many were applied and how many were left for review. `trigger(input)` rejects with the back end failure. */
export const useMutateApplyBrainFactGroupSwr = () =>
    useSWRMutation(MUTATE_APPLY_BRAIN_FACT_GROUP_SWR_KEY, async (_key: string, { arg }: ApplyBrainFactGroupArg) => {
        const result = await mutateApplyBrainFactGroup({ request: arg })
        if (!result.data) throw new Error("applyBrainFactGroup answered no data")
        return result.data.applyBrainFactGroup
    })
