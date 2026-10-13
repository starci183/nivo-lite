import useSWRMutation from "swr/mutation"
import { mutateSaveInventoryLocation } from "@/modules/api/graphql/mutations/mutation-save-inventory-location"
import type { MutateSaveInventoryLocationRequest } from "@/modules/api/graphql/mutations/mutation-save-inventory-location"

/** What the saveInventoryLocation mutation is triggered with. */
interface SaveInventoryLocationArg {
    readonly arg: MutateSaveInventoryLocationRequest
}

/** The SWR key of the `saveInventoryLocation` mutation. */
export const MUTATE_SAVE_INVENTORY_LOCATION_SWR_KEY = "MUTATE_SAVE_INVENTORY_LOCATION_SWR"

/** SWR mutation for {@link mutateSaveInventoryLocation}: `trigger(request)` answers `saveInventoryLocation` and rejects with the back end failure. */
export const useMutateSaveInventoryLocationSwr = () =>
    useSWRMutation(MUTATE_SAVE_INVENTORY_LOCATION_SWR_KEY, async (_key: string, { arg }: SaveInventoryLocationArg) => {
        const result = await mutateSaveInventoryLocation({ request: arg })
        if (!result.data) throw new Error("saveInventoryLocation answered no data")
        return result.data.saveInventoryLocation
    })
