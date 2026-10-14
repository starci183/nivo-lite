"use client"

import useSWRMutation from "swr/mutation"
import { mutateTakeInventoryStock } from "@/modules/api/graphql/mutations/mutation-take-inventory-stock"
import type { MutateTakeInventoryStockRequest } from "@/modules/api/graphql/mutations/mutation-take-inventory-stock"

/** What the takeInventoryStock mutation is triggered with. */
interface TakeInventoryStockArg {
    readonly arg: MutateTakeInventoryStockRequest
}

/** The SWR key of the `takeInventoryStock` mutation. */
export const MUTATE_TAKE_INVENTORY_STOCK_SWR_KEY = "MUTATE_TAKE_INVENTORY_STOCK_SWR"

/** SWR mutation for {@link mutateTakeInventoryStock}: `trigger(request)` answers `takeInventoryStock` and rejects with the back end failure. */
export const useMutateTakeInventoryStockSwr = () =>
    useSWRMutation(MUTATE_TAKE_INVENTORY_STOCK_SWR_KEY, async (_key: string, { arg }: TakeInventoryStockArg) => {
        const result = await mutateTakeInventoryStock({ request: arg })
        if (!result.data) throw new Error("takeInventoryStock answered no data")
        return result.data.takeInventoryStock
    })
