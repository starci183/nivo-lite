"use client"

import useSWRMutation from "swr/mutation"
import { mutateAdjustLoyaltyPoints } from "@/modules/api/graphql/mutations/mutation-adjust-loyalty-points"
import type { MutateAdjustLoyaltyPointsRequest } from "@/modules/api/graphql/mutations/types/adjust-loyalty-points"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** The SWR key of the `adjustLoyaltyPoints` mutation. */
export const MUTATE_ADJUST_LOYALTY_POINTS_SWR_KEY = "MUTATE_ADJUST_LOYALTY_POINTS_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutateAdjustLoyaltyPointsRequest
}

/** Adjusts the points of one member; posted says the ledger row was written right away. */
export const useMutateAdjustLoyaltyPointsSwr = (): SWRMutationResponse<
    OperationData<typeof mutateAdjustLoyaltyPoints>["adjustLoyaltyPoints"],
    Error,
    typeof MUTATE_ADJUST_LOYALTY_POINTS_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(MUTATE_ADJUST_LOYALTY_POINTS_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateAdjustLoyaltyPoints({ request: arg })
        if (!result.data) throw new Error("adjustLoyaltyPoints answered no data")
        return result.data.adjustLoyaltyPoints
    })
