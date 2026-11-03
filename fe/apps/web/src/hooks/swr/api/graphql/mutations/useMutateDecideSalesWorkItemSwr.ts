"use client"

import useSWRMutation from "swr/mutation"
import { mutateDecideSalesWorkItem } from "@/modules/api/graphql/mutations/mutation-decide-sales-work-item"
import type { MutateDecideSalesWorkItemRequest } from "@/modules/api/graphql/mutations/mutation-decide-sales-work-item"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** What the decideSalesWorkItem mutation is triggered with. */
interface DecideSalesWorkItemArg {
    readonly arg: MutateDecideSalesWorkItemRequest
}

/** The SWR key of the decideSalesWorkItem mutation. */
export const MUTATE_DECIDE_SALES_WORK_ITEM_SWR_KEY = "MUTATE_DECIDE_SALES_WORK_ITEM_SWR"

/** SWR mutation for {@link mutateDecideSalesWorkItem}: `trigger(request)` answers the result and rejects with the back end failure. */
export const useMutateDecideSalesWorkItemSwr = (): SWRMutationResponse<
    OperationData<typeof mutateDecideSalesWorkItem>["decideSalesWorkItem"],
    Error,
    typeof MUTATE_DECIDE_SALES_WORK_ITEM_SWR_KEY,
    DecideSalesWorkItemArg["arg"]
> =>
    useSWRMutation(MUTATE_DECIDE_SALES_WORK_ITEM_SWR_KEY, async (_key: string, { arg }: DecideSalesWorkItemArg) => {
        const result = await mutateDecideSalesWorkItem({ request: arg })
        if (!result.data) throw new Error("decideSalesWorkItem answered no data")
        return result.data.decideSalesWorkItem
    })
