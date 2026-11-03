"use client"

import useSWRMutation from "swr/mutation"
import { mutateCancelInventoryPo } from "@/modules/api/graphql/mutations/mutation-cancel-inventory-po"
import type { MutateCancelInventoryPoRequest } from "@/modules/api/graphql/mutations/mutation-cancel-inventory-po"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** What the cancelInventoryPo mutation is triggered with. */
interface CancelInventoryPoArg {
    readonly arg: MutateCancelInventoryPoRequest
}

/** The SWR key of the `cancelInventoryPo` mutation. */
export const MUTATE_CANCEL_INVENTORY_PO_SWR_KEY = "MUTATE_CANCEL_INVENTORY_PO_SWR"

/** SWR mutation for {@link mutateCancelInventoryPo}: `trigger(request)` answers `cancelInventoryPo` and rejects with the back end failure. */
export const useMutateCancelInventoryPoSwr = (): SWRMutationResponse<
    OperationData<typeof mutateCancelInventoryPo>["cancelInventoryPo"],
    Error,
    typeof MUTATE_CANCEL_INVENTORY_PO_SWR_KEY,
    CancelInventoryPoArg["arg"]
> =>
    useSWRMutation(MUTATE_CANCEL_INVENTORY_PO_SWR_KEY, async (_key: string, { arg }: CancelInventoryPoArg) => {
        const result = await mutateCancelInventoryPo({ request: arg })
        if (!result.data) throw new Error("cancelInventoryPo answered no data")
        return result.data.cancelInventoryPo
    })
