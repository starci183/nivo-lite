import useSWRMutation from "swr/mutation"
import { mutateSetInventoryItemActive } from "@/modules/api/graphql/mutations/mutation-set-inventory-item-active"
import type { MutateSetInventoryItemActiveRequest } from "@/modules/api/graphql/mutations/mutation-set-inventory-item-active"

/** What the setInventoryItemActive mutation is triggered with. */
interface SetInventoryItemActiveArg {
    readonly arg: MutateSetInventoryItemActiveRequest
}

/** The SWR key of the `setInventoryItemActive` mutation. */
export const MUTATE_SET_INVENTORY_ITEM_ACTIVE_SWR_KEY = "MUTATE_SET_INVENTORY_ITEM_ACTIVE_SWR"

/** SWR mutation for {@link mutateSetInventoryItemActive}: `trigger(request)` answers `setInventoryItemActive` and rejects with the back end failure. */
export const useMutateSetInventoryItemActiveSwr = () =>
    useSWRMutation(
        MUTATE_SET_INVENTORY_ITEM_ACTIVE_SWR_KEY,
        async (_key: string, { arg }: SetInventoryItemActiveArg) => {
            const result = await mutateSetInventoryItemActive({ request: arg })
            if (!result.data) throw new Error("setInventoryItemActive answered no data")
            return result.data.setInventoryItemActive
        },
    )
