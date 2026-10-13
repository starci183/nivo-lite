import useSWRMutation from "swr/mutation"
import { mutateReceiveInventoryPo } from "@/modules/api/graphql/mutations/mutation-receive-inventory-po"
import type { MutateReceiveInventoryPoRequest } from "@/modules/api/graphql/mutations/mutation-receive-inventory-po"

/** What the receiveInventoryPo mutation is triggered with. */
interface ReceiveInventoryPoArg {
    readonly arg: MutateReceiveInventoryPoRequest
}

/** The SWR key of the `receiveInventoryPo` mutation. */
export const MUTATE_RECEIVE_INVENTORY_PO_SWR_KEY = "MUTATE_RECEIVE_INVENTORY_PO_SWR"

/** SWR mutation for {@link mutateReceiveInventoryPo}: `trigger(request)` answers `receiveInventoryPo` and rejects with the back end failure. */
export const useMutateReceiveInventoryPoSwr = () =>
    useSWRMutation(MUTATE_RECEIVE_INVENTORY_PO_SWR_KEY, async (_key: string, { arg }: ReceiveInventoryPoArg) => {
        const result = await mutateReceiveInventoryPo({ request: arg })
        if (!result.data) throw new Error("receiveInventoryPo answered no data")
        return result.data.receiveInventoryPo
    })
