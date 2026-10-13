import useSWRMutation from "swr/mutation"
import { mutateAdjustInventoryStock } from "@/modules/api/graphql/mutations/mutation-adjust-inventory-stock"
import type { MutateAdjustInventoryStockRequest } from "@/modules/api/graphql/mutations/mutation-adjust-inventory-stock"

/** What the adjustInventoryStock mutation is triggered with. */
interface AdjustInventoryStockArg {
    readonly arg: MutateAdjustInventoryStockRequest
}

/** The SWR key of the `adjustInventoryStock` mutation. */
export const MUTATE_ADJUST_INVENTORY_STOCK_SWR_KEY = "MUTATE_ADJUST_INVENTORY_STOCK_SWR"

/** SWR mutation for {@link mutateAdjustInventoryStock}: `trigger(request)` answers `adjustInventoryStock` and rejects with the back end failure. */
export const useMutateAdjustInventoryStockSwr = () =>
    useSWRMutation(MUTATE_ADJUST_INVENTORY_STOCK_SWR_KEY, async (_key: string, { arg }: AdjustInventoryStockArg) => {
        const result = await mutateAdjustInventoryStock({ request: arg })
        if (!result.data) throw new Error("adjustInventoryStock answered no data")
        return result.data.adjustInventoryStock
    })
