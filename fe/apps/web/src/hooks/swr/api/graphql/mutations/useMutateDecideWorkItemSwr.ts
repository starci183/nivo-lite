import useSWRMutation from "swr/mutation"
import { mutateDecideWorkItem } from "@/modules/api/graphql/mutations"
import type { MutateDecideWorkItemRequest } from "@/modules/api/graphql/mutations/types/decide-work-item"

/** The SWR key of the `decideWorkItem` mutation. */
export const MUTATE_DECIDE_WORK_ITEM_SWR_KEY = "MUTATE_DECIDE_WORK_ITEM_SWR"

/** Approves or rejects a waiting work item (with optional edits, such as a corrected promo draft). */
export const useMutateDecideWorkItemSwr = () =>
    useSWRMutation(MUTATE_DECIDE_WORK_ITEM_SWR_KEY, async (_key: string, { arg }: { arg: MutateDecideWorkItemRequest }) => {
        const result = await mutateDecideWorkItem({ request: arg })
        if (!result.data) throw new Error("decideWorkItem answered no data")
        return result.data.decideWorkItem
    })
