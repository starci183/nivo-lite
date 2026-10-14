"use client"

import useSWRMutation from "swr/mutation"
import { mutateRemoveLoyaltyReward } from "@/modules/api/graphql/mutations/mutation-remove-loyalty-reward"
import type { MutateRemoveLoyaltyRewardRequest } from "@/modules/api/graphql/mutations/types/remove-loyalty-reward"

/** The SWR key of the `removeLoyaltyReward` mutation. */
export const MUTATE_REMOVE_LOYALTY_REWARD_SWR_KEY = "MUTATE_REMOVE_LOYALTY_REWARD_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutateRemoveLoyaltyRewardRequest
}

/** Removes one reward of the catalogue. */
export const useMutateRemoveLoyaltyRewardSwr = () =>
    useSWRMutation(MUTATE_REMOVE_LOYALTY_REWARD_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateRemoveLoyaltyReward({ request: arg })
        if (!result.data) throw new Error("removeLoyaltyReward answered no data")
        return result.data.removeLoyaltyReward
    })
