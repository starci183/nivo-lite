import useSWRMutation from "swr/mutation"
import { mutateSaveLoyaltyReward } from "@/modules/api/graphql/mutations/mutation-save-loyalty-reward"
import type { MutateSaveLoyaltyRewardRequest } from "@/modules/api/graphql/mutations/types/save-loyalty-reward"

/** The SWR key of the `saveLoyaltyReward` mutation. */
export const MUTATE_SAVE_LOYALTY_REWARD_SWR_KEY = "MUTATE_SAVE_LOYALTY_REWARD_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutateSaveLoyaltyRewardRequest
}

/** Creates or updates one reward of the catalogue (id null creates). */
export const useMutateSaveLoyaltyRewardSwr = () =>
    useSWRMutation(MUTATE_SAVE_LOYALTY_REWARD_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateSaveLoyaltyReward({ request: arg })
        if (!result.data) throw new Error("saveLoyaltyReward answered no data")
        return result.data.saveLoyaltyReward
    })
