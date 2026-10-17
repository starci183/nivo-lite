"use client"

import { mutateDecideWorkItem } from "@/modules/api/graphql/mutations/mutation-decide-work-item"
import type { MutateDecideWorkItemRequest } from "@/modules/api/graphql/mutations/mutation-decide-work-item"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the decideWorkItem mutation. */
export const MUTATE_DECIDE_WORK_ITEM_SWR_KEY = "MUTATE_DECIDE_WORK_ITEM_SWR"

/** SWR mutation for {@link mutateDecideWorkItem}: Approves or rejects a waiting work item. `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateDecideWorkItemSwr = () =>
    useSWRMutation(
        MUTATE_DECIDE_WORK_ITEM_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateDecideWorkItem({ request: arg }), MUTATE_DECIDE_WORK_ITEM_SWR_KEY).decideWorkItem,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateDecideWorkItemRequest
}
