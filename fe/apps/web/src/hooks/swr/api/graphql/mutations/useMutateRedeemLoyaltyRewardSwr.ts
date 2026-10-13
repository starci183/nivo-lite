import useSWRMutation from "swr/mutation"
import { mutateRedeemLoyaltyReward } from "@/modules/api/graphql/mutations"
import type { MutateRedeemLoyaltyRewardRequest } from "@/modules/api/graphql/mutations/types/redeem-loyalty-reward"

/** The SWR key of the `redeemLoyaltyReward` mutation. */
export const MUTATE_REDEEM_LOYALTY_REWARD_SWR_KEY = "MUTATE_REDEEM_LOYALTY_REWARD_SWR"

/** Redeems a reward for a member; answers the redemption code the customer shows. */
export const useMutateRedeemLoyaltyRewardSwr = () =>
    useSWRMutation(MUTATE_REDEEM_LOYALTY_REWARD_SWR_KEY, async (_key: string, { arg }: { arg: MutateRedeemLoyaltyRewardRequest }) => {
        const result = await mutateRedeemLoyaltyReward({ request: arg })
        if (!result.data) throw new Error("redeemLoyaltyReward answered no data")
        return result.data.redeemLoyaltyReward
    })
