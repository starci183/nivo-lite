import useSWRMutation from "swr/mutation"
import { mutateAdjustLoyaltyPoints } from "@/modules/api/graphql/mutations"
import type { MutateAdjustLoyaltyPointsRequest } from "@/modules/api/graphql/mutations/types/adjust-loyalty-points"

/** The SWR key of the `adjustLoyaltyPoints` mutation. */
export const MUTATE_ADJUST_LOYALTY_POINTS_SWR_KEY = "MUTATE_ADJUST_LOYALTY_POINTS_SWR"

/** Adjusts the points of one member; posted says the ledger row was written right away. */
export const useMutateAdjustLoyaltyPointsSwr = () =>
    useSWRMutation(MUTATE_ADJUST_LOYALTY_POINTS_SWR_KEY, async (_key: string, { arg }: { arg: MutateAdjustLoyaltyPointsRequest }) => {
        const result = await mutateAdjustLoyaltyPoints({ request: arg })
        if (!result.data) throw new Error("adjustLoyaltyPoints answered no data")
        return result.data.adjustLoyaltyPoints
    })
