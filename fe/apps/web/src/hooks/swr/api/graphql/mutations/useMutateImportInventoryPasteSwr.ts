"use client"

import useSWRMutation from "swr/mutation"
import { mutateImportInventoryPaste } from "@/modules/api/graphql/mutations/mutation-import-inventory-paste"
import type { MutateImportInventoryPasteRequest } from "@/modules/api/graphql/mutations/mutation-import-inventory-paste"

/** What the importInventoryPaste mutation is triggered with. */
interface ImportInventoryPasteArg {
    readonly arg: MutateImportInventoryPasteRequest
}

/** The SWR key of the `importInventoryPaste` mutation. */
export const MUTATE_IMPORT_INVENTORY_PASTE_SWR_KEY = "MUTATE_IMPORT_INVENTORY_PASTE_SWR"

/** SWR mutation for {@link mutateImportInventoryPaste}: `trigger(request)` answers `importInventoryPaste` and rejects with the back end failure. */
export const useMutateImportInventoryPasteSwr = () =>
    useSWRMutation(MUTATE_IMPORT_INVENTORY_PASTE_SWR_KEY, async (_key: string, { arg }: ImportInventoryPasteArg) => {
        const result = await mutateImportInventoryPaste({ request: arg })
        if (!result.data) throw new Error("importInventoryPaste answered no data")
        return result.data.importInventoryPaste
    })
