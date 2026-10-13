import useSWRMutation from "swr/mutation"
import { mutateDecideWorkItem } from "@/modules/api/graphql/mutations/mutation-decide-work-item"
import type { MutateDecideWorkItemRequest } from "@/modules/api/graphql/mutations/mutation-decide-work-item"

/** What the DecideWorkItem mutation is triggered with. */
interface DecideWorkItemArg {
    readonly arg: MutateDecideWorkItemRequest
}

/** The SWR key of {@link useMutateDecideWorkItemSwr}. */
export const MUTATE_DECIDE_WORK_ITEM_SWR_KEY = "MUTATE_DECIDE_WORK_ITEM_SWR"

/** SWR mutation for {@link mutateDecideWorkItem}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateDecideWorkItemSwr = () =>
    useSWRMutation(MUTATE_DECIDE_WORK_ITEM_SWR_KEY, async (_key: string, { arg }: DecideWorkItemArg) => {
        const result = await mutateDecideWorkItem({ request: arg })
        if (!result.data) throw new Error("decideWorkItem answered no data")
        return result.data.decideWorkItem
    })
