import useSWRMutation from "swr/mutation"
import { mutateSaveInventorySupplier } from "@/modules/api/graphql/mutations/mutation-save-inventory-supplier"
import type { MutateSaveInventorySupplierRequest } from "@/modules/api/graphql/mutations/mutation-save-inventory-supplier"

/** What the saveInventorySupplier mutation is triggered with. */
interface SaveInventorySupplierArg {
    readonly arg: MutateSaveInventorySupplierRequest
}

/** The SWR key of the `saveInventorySupplier` mutation. */
export const MUTATE_SAVE_INVENTORY_SUPPLIER_SWR_KEY = "MUTATE_SAVE_INVENTORY_SUPPLIER_SWR"

/** SWR mutation for {@link mutateSaveInventorySupplier}: `trigger(request)` answers `saveInventorySupplier` and rejects with the back end failure. */
export const useMutateSaveInventorySupplierSwr = () =>
    useSWRMutation(MUTATE_SAVE_INVENTORY_SUPPLIER_SWR_KEY, async (_key: string, { arg }: SaveInventorySupplierArg) => {
        const result = await mutateSaveInventorySupplier({ request: arg })
        if (!result.data) throw new Error("saveInventorySupplier answered no data")
        return result.data.saveInventorySupplier
    })
