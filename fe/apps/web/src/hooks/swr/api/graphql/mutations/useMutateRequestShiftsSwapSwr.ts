import useSWRMutation from "swr/mutation"
import { mutateRequestShiftsSwap } from "@/modules/api/graphql/mutations/mutation-request-shifts-swap"
import type { MutateRequestShiftsSwapRequest } from "@/modules/api/graphql/mutations/mutation-request-shifts-swap"

/** What the requestShiftsSwap mutation is triggered with. */
interface RequestShiftsSwapArg {
    readonly arg: MutateRequestShiftsSwapRequest
}

/** The SWR key of the `requestShiftsSwap` mutation. */
export const MUTATE_REQUEST_SHIFTS_SWAP_SWR_KEY = "MUTATE_REQUEST_SHIFTS_SWAP_SWR"

/** SWR mutation for {@link mutateRequestShiftsSwap}: `trigger(request)` answers `requestShiftsSwap` and rejects with the back end failure. */
export const useMutateRequestShiftsSwapSwr = () =>
    useSWRMutation(MUTATE_REQUEST_SHIFTS_SWAP_SWR_KEY, async (_key: string, { arg }: RequestShiftsSwapArg) => {
        const result = await mutateRequestShiftsSwap({ request: arg })
        if (!result.data) throw new Error("requestShiftsSwap answered no data")
        return result.data.requestShiftsSwap
    })
