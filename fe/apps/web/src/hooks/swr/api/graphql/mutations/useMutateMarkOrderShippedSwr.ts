import useSWRMutation from "swr/mutation"
import { mutateMarkOrderShipped } from "@/modules/api/graphql/mutations/mutation-mark-order-shipped"
import type { MutateMarkOrderShippedRequest } from "@/modules/api/graphql/mutations/mutation-mark-order-shipped"

/** What the markOrderShipped mutation is triggered with. */
interface MarkOrderShippedArg {
    readonly arg: MutateMarkOrderShippedRequest
}

/** The SWR key of the markOrderShipped mutation. */
export const MUTATE_MARK_ORDER_SHIPPED_SWR_KEY = "MUTATE_MARK_ORDER_SHIPPED_SWR"

/** SWR mutation for {@link mutateMarkOrderShipped}: `trigger(request)` answers the result and rejects with the back end failure. */
export const useMutateMarkOrderShippedSwr = () =>
    useSWRMutation(MUTATE_MARK_ORDER_SHIPPED_SWR_KEY, async (_key: string, { arg }: MarkOrderShippedArg) => {
        const result = await mutateMarkOrderShipped({ request: arg })
        if (!result.data) throw new Error("markOrderShipped answered no data")
        return result.data.markOrderShipped
    })
