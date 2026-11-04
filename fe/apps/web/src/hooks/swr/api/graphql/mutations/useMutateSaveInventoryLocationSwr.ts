"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateSaveInventoryLocation,
    type MutateSaveInventoryLocationRequest,
} from "@/modules/api/graphql/mutations/mutation-save-inventory-location"
import type { SWRMutationResponse } from "swr/mutation"
import type { SaveInventoryLocationMutation } from "@/modules/api"

/** What the saveInventoryLocation mutation is triggered with. */
interface SaveInventoryLocationArg {
    readonly arg: MutateSaveInventoryLocationRequest
}

/** The SWR key of the `saveInventoryLocation` mutation. */
export const MUTATE_SAVE_INVENTORY_LOCATION_SWR_KEY = "MUTATE_SAVE_INVENTORY_LOCATION_SWR"

/** SWR mutation for {@link mutateSaveInventoryLocation}: `trigger(request)` answers `saveInventoryLocation` and rejects with the back end failure. */
export const useMutateSaveInventoryLocationSwr = (): SWRMutationResponse<
    SaveInventoryLocationMutation["saveInventoryLocation"],
    Error,
    typeof MUTATE_SAVE_INVENTORY_LOCATION_SWR_KEY,
    SaveInventoryLocationArg["arg"]
> =>
    useSWRMutation(MUTATE_SAVE_INVENTORY_LOCATION_SWR_KEY, async (_key: string, { arg }: SaveInventoryLocationArg) => {
        const result = await mutateSaveInventoryLocation({ request: arg })
        if (!result.data) throw new Error("saveInventoryLocation answered no data")
        return result.data.saveInventoryLocation
    })
