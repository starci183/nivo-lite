"use client"

import useSWRMutation from "swr/mutation"
import { mutateSaveInventoryItem } from "@/modules/api/graphql/mutations/mutation-save-inventory-item"
import type { MutateSaveInventoryItemRequest } from "@/modules/api/graphql/mutations/mutation-save-inventory-item"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** What the saveInventoryItem mutation is triggered with. */
interface SaveInventoryItemArg {
    readonly arg: MutateSaveInventoryItemRequest
}

/** The SWR key of the `saveInventoryItem` mutation. */
export const MUTATE_SAVE_INVENTORY_ITEM_SWR_KEY = "MUTATE_SAVE_INVENTORY_ITEM_SWR"

/** SWR mutation for {@link mutateSaveInventoryItem}: `trigger(request)` answers `saveInventoryItem` and rejects with the back end failure. */
export const useMutateSaveInventoryItemSwr = (): SWRMutationResponse<
    OperationData<typeof mutateSaveInventoryItem>["saveInventoryItem"],
    Error,
    typeof MUTATE_SAVE_INVENTORY_ITEM_SWR_KEY,
    SaveInventoryItemArg["arg"]
> =>
    useSWRMutation(MUTATE_SAVE_INVENTORY_ITEM_SWR_KEY, async (_key: string, { arg }: SaveInventoryItemArg) => {
        const result = await mutateSaveInventoryItem({ request: arg })
        if (!result.data) throw new Error("saveInventoryItem answered no data")
        return result.data.saveInventoryItem
    })
