import useSWRMutation from "swr/mutation"
import { mutateCreateInventoryPo } from "@/modules/api/graphql/mutations/mutation-create-inventory-po"
import type { MutateCreateInventoryPoRequest } from "@/modules/api/graphql/mutations/mutation-create-inventory-po"

/** What the createInventoryPo mutation is triggered with. */
interface CreateInventoryPoArg {
    readonly arg: MutateCreateInventoryPoRequest
}

/** The SWR key of the `createInventoryPo` mutation. */
export const MUTATE_CREATE_INVENTORY_PO_SWR_KEY = "MUTATE_CREATE_INVENTORY_PO_SWR"

/** SWR mutation for {@link mutateCreateInventoryPo}: `trigger(request)` answers `createInventoryPo` and rejects with the back end failure. */
export const useMutateCreateInventoryPoSwr = () =>
    useSWRMutation(MUTATE_CREATE_INVENTORY_PO_SWR_KEY, async (_key: string, { arg }: CreateInventoryPoArg) => {
        const result = await mutateCreateInventoryPo({ request: arg })
        if (!result.data) throw new Error("createInventoryPo answered no data")
        return result.data.createInventoryPo
    })
