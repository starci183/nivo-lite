"use client"

import useSWRMutation from "swr/mutation"
import { mutateTransferInventoryStock } from "@/modules/api/graphql/mutations/mutation-transfer-inventory-stock"
import type { MutateTransferInventoryStockRequest } from "@/modules/api/graphql/mutations/mutation-transfer-inventory-stock"

/** What the transferInventoryStock mutation is triggered with. */
interface TransferInventoryStockArg {
    readonly arg: MutateTransferInventoryStockRequest
}

/** The SWR key of the `transferInventoryStock` mutation. */
export const MUTATE_TRANSFER_INVENTORY_STOCK_SWR_KEY = "MUTATE_TRANSFER_INVENTORY_STOCK_SWR"

/** SWR mutation for {@link mutateTransferInventoryStock}: `trigger(request)` answers `transferInventoryStock` and rejects with the back end failure. */
export const useMutateTransferInventoryStockSwr = () =>
    useSWRMutation(
        MUTATE_TRANSFER_INVENTORY_STOCK_SWR_KEY,
        async (_key: string, { arg }: TransferInventoryStockArg) => {
            const result = await mutateTransferInventoryStock({ request: arg })
            if (!result.data) throw new Error("transferInventoryStock answered no data")
            return result.data.transferInventoryStock
        },
    )
