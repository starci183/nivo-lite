"use client"

import useSWRMutation from "swr/mutation"
import { mutateAddLoyaltyPresetRewards } from "@/modules/api/graphql/mutations/mutation-add-loyalty-preset-rewards"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** The SWR key of the `addLoyaltyPresetRewards` mutation. */
export const MUTATE_ADD_LOYALTY_PRESET_REWARDS_SWR_KEY = "MUTATE_ADD_LOYALTY_PRESET_REWARDS_SWR"

/** Starts the reward catalogue from the built-in presets (no input). */
export const useMutateAddLoyaltyPresetRewardsSwr = (): SWRMutationResponse<
    OperationData<typeof mutateAddLoyaltyPresetRewards>["addLoyaltyPresetRewards"],
    Error,
    typeof MUTATE_ADD_LOYALTY_PRESET_REWARDS_SWR_KEY,
    never
> =>
    useSWRMutation(MUTATE_ADD_LOYALTY_PRESET_REWARDS_SWR_KEY, async (_key: string) => {
        const result = await mutateAddLoyaltyPresetRewards()
        if (!result.data) throw new Error("addLoyaltyPresetRewards answered no data")
        return result.data.addLoyaltyPresetRewards
    })
