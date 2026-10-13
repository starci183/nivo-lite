import useSWRMutation from "swr/mutation"
import { mutateApplyInventoryStarter } from "@/modules/api/graphql/mutations/mutation-apply-inventory-starter"
import type { MutateApplyInventoryStarterRequest } from "@/modules/api/graphql/mutations/mutation-apply-inventory-starter"

/** What the applyInventoryStarter mutation is triggered with. */
interface ApplyInventoryStarterArg {
    readonly arg: MutateApplyInventoryStarterRequest
}

/** The SWR key of the `applyInventoryStarter` mutation. */
export const MUTATE_APPLY_INVENTORY_STARTER_SWR_KEY = "MUTATE_APPLY_INVENTORY_STARTER_SWR"

/** SWR mutation for {@link mutateApplyInventoryStarter}: `trigger(request)` answers `applyInventoryStarter` and rejects with the back end failure. */
export const useMutateApplyInventoryStarterSwr = () =>
    useSWRMutation(MUTATE_APPLY_INVENTORY_STARTER_SWR_KEY, async (_key: string, { arg }: ApplyInventoryStarterArg) => {
        const result = await mutateApplyInventoryStarter({ request: arg })
        if (!result.data) throw new Error("applyInventoryStarter answered no data")
        return result.data.applyInventoryStarter
    })
