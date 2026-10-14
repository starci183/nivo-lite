"use client"

import useSWRMutation from "swr/mutation"
import { mutateSettleWonDeal } from "@/modules/api/graphql/mutations/mutation-settle-won-deal"
import type { MutateSettleWonDealRequest } from "@/modules/api/graphql/mutations/mutation-settle-won-deal"

/** What the settleWonDeal mutation is triggered with. */
interface SettleWonDealArg {
    readonly arg: MutateSettleWonDealRequest
}

/** The SWR key of the settleWonDeal mutation. */
export const MUTATE_SETTLE_WON_DEAL_SWR_KEY = "MUTATE_SETTLE_WON_DEAL_SWR"

/** SWR mutation for {@link mutateSettleWonDeal}: `trigger(request)` answers the result and rejects with the back end failure. */
export const useMutateSettleWonDealSwr = () =>
    useSWRMutation(MUTATE_SETTLE_WON_DEAL_SWR_KEY, async (_key: string, { arg }: SettleWonDealArg) => {
        const result = await mutateSettleWonDeal({ request: arg })
        if (!result.data) throw new Error("settleWonDeal answered no data")
        return result.data.settleWonDeal
    })
