"use client"

import useSWRMutation from "swr/mutation"
import { mutateDraftInventoryLowStock } from "@/modules/api/graphql/mutations/mutation-draft-inventory-low-stock"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** The SWR key of the `draftInventoryLowStock` mutation. */
export const MUTATE_DRAFT_INVENTORY_LOW_STOCK_SWR_KEY = "MUTATE_DRAFT_INVENTORY_LOW_STOCK_SWR"

/** SWR mutation for {@link mutateDraftInventoryLowStock}: `trigger(request)` answers `draftInventoryLowStock` and rejects with the back end failure. */
export const useMutateDraftInventoryLowStockSwr = (): SWRMutationResponse<
    OperationData<typeof mutateDraftInventoryLowStock>["draftInventoryLowStock"],
    Error,
    typeof MUTATE_DRAFT_INVENTORY_LOW_STOCK_SWR_KEY,
    never
> =>
    useSWRMutation(MUTATE_DRAFT_INVENTORY_LOW_STOCK_SWR_KEY, async () => {
        const result = await mutateDraftInventoryLowStock()
        if (!result.data) throw new Error("draftInventoryLowStock answered no data")
        return result.data.draftInventoryLowStock
    })
