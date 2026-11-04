"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateAdjustInventoryStock,
    type MutateAdjustInventoryStockRequest,
} from "@/modules/api/graphql/mutations/mutation-adjust-inventory-stock"
import type { SWRMutationResponse } from "swr/mutation"
import type { AdjustInventoryStockMutation } from "@/modules/api"

/** What the adjustInventoryStock mutation is triggered with. */
interface AdjustInventoryStockArg {
    readonly arg: MutateAdjustInventoryStockRequest
}

/** The SWR key of the `adjustInventoryStock` mutation. */
export const MUTATE_ADJUST_INVENTORY_STOCK_SWR_KEY = "MUTATE_ADJUST_INVENTORY_STOCK_SWR"

/** SWR mutation for {@link mutateAdjustInventoryStock}: `trigger(request)` answers `adjustInventoryStock` and rejects with the back end failure. */
export const useMutateAdjustInventoryStockSwr = (): SWRMutationResponse<
    AdjustInventoryStockMutation["adjustInventoryStock"],
    Error,
    typeof MUTATE_ADJUST_INVENTORY_STOCK_SWR_KEY,
    AdjustInventoryStockArg["arg"]
> =>
    useSWRMutation(MUTATE_ADJUST_INVENTORY_STOCK_SWR_KEY, async (_key: string, { arg }: AdjustInventoryStockArg) => {
        const result = await mutateAdjustInventoryStock({ request: arg })
        if (!result.data) throw new Error("adjustInventoryStock answered no data")
        return result.data.adjustInventoryStock
    })
