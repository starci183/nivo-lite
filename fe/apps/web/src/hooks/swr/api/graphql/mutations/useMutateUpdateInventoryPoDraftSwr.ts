"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateUpdateInventoryPoDraft,
    type MutateUpdateInventoryPoDraftRequest,
} from "@/modules/api/graphql/mutations/mutation-update-inventory-po-draft"
import type { SWRMutationResponse } from "swr/mutation"
import type { UpdateInventoryPoDraftMutation } from "@/modules/api"

/** What the updateInventoryPoDraft mutation is triggered with. */
interface UpdateInventoryPoDraftArg {
    readonly arg: MutateUpdateInventoryPoDraftRequest
}

/** The SWR key of the `updateInventoryPoDraft` mutation. */
export const MUTATE_UPDATE_INVENTORY_PO_DRAFT_SWR_KEY = "MUTATE_UPDATE_INVENTORY_PO_DRAFT_SWR"

/** SWR mutation for {@link mutateUpdateInventoryPoDraft}: `trigger(request)` answers `updateInventoryPoDraft` and rejects with the back end failure. */
export const useMutateUpdateInventoryPoDraftSwr = (): SWRMutationResponse<
    UpdateInventoryPoDraftMutation["updateInventoryPoDraft"],
    Error,
    typeof MUTATE_UPDATE_INVENTORY_PO_DRAFT_SWR_KEY,
    UpdateInventoryPoDraftArg["arg"]
> =>
    useSWRMutation(
        MUTATE_UPDATE_INVENTORY_PO_DRAFT_SWR_KEY,
        async (_key: string, { arg }: UpdateInventoryPoDraftArg) => {
            const result = await mutateUpdateInventoryPoDraft({ request: arg })
            if (!result.data) throw new Error("updateInventoryPoDraft answered no data")
            return result.data.updateInventoryPoDraft
        },
    )
