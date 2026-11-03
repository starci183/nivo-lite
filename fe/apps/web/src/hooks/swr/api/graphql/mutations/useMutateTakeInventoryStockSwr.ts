"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateTakeInventoryStock,
    type MutateTakeInventoryStockRequest,
} from "@/modules/api/graphql/mutations/mutation-take-inventory-stock"
import type { SWRMutationResponse } from "swr/mutation"
import type { TakeInventoryStockMutation } from "@/modules/api"

/** What the takeInventoryStock mutation is triggered with. */
interface TakeInventoryStockArg {
    readonly arg: MutateTakeInventoryStockRequest
}

/** The SWR key of the `takeInventoryStock` mutation. */
export const MUTATE_TAKE_INVENTORY_STOCK_SWR_KEY = "MUTATE_TAKE_INVENTORY_STOCK_SWR"

/** SWR mutation for {@link mutateTakeInventoryStock}: `trigger(request)` answers `takeInventoryStock` and rejects with the back end failure. */
export const useMutateTakeInventoryStockSwr = (): SWRMutationResponse<
    TakeInventoryStockMutation["takeInventoryStock"],
    Error,
    typeof MUTATE_TAKE_INVENTORY_STOCK_SWR_KEY,
    TakeInventoryStockArg["arg"]
> =>
    useSWRMutation(MUTATE_TAKE_INVENTORY_STOCK_SWR_KEY, async (_key: string, { arg }: TakeInventoryStockArg) => {
        const result = await mutateTakeInventoryStock({ request: arg })
        if (!result.data) throw new Error("takeInventoryStock answered no data")
        return result.data.takeInventoryStock
    })
