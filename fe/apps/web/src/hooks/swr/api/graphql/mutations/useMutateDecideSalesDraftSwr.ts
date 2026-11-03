"use client"

import useSWRMutation from "swr/mutation"
import { mutateDecideSalesDraft } from "@/modules/api/graphql/mutations/mutation-decide-sales-draft"
import type { MutateDecideSalesDraftRequest } from "@/modules/api/graphql/mutations/mutation-decide-sales-draft"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** What the decideSalesDraft mutation is triggered with. */
interface DecideSalesDraftArg {
    readonly arg: MutateDecideSalesDraftRequest
}

/** The SWR key of the decideSalesDraft mutation. */
export const MUTATE_DECIDE_SALES_DRAFT_SWR_KEY = "MUTATE_DECIDE_SALES_DRAFT_SWR"

/** SWR mutation for {@link mutateDecideSalesDraft}: `trigger(request)` answers the result and rejects with the back end failure. */
export const useMutateDecideSalesDraftSwr = (): SWRMutationResponse<
    OperationData<typeof mutateDecideSalesDraft>["decideSalesDraft"],
    Error,
    typeof MUTATE_DECIDE_SALES_DRAFT_SWR_KEY,
    DecideSalesDraftArg["arg"]
> =>
    useSWRMutation(MUTATE_DECIDE_SALES_DRAFT_SWR_KEY, async (_key: string, { arg }: DecideSalesDraftArg) => {
        const result = await mutateDecideSalesDraft({ request: arg })
        if (!result.data) throw new Error("decideSalesDraft answered no data")
        return result.data.decideSalesDraft
    })
