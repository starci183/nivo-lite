"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateRefreshLeadContext,
    type MutateRefreshLeadContextRequest,
} from "@/modules/api/graphql/mutations/mutation-refresh-lead-context"
import type { SWRMutationResponse } from "swr/mutation"
import type { RefreshLeadContextMutation } from "@/modules/api"

/** What the refreshLeadContext mutation is triggered with. */
interface RefreshLeadContextArg {
    readonly arg: MutateRefreshLeadContextRequest
}

/** The SWR key of the refreshLeadContext mutation. */
export const MUTATE_REFRESH_LEAD_CONTEXT_SWR_KEY = "MUTATE_REFRESH_LEAD_CONTEXT_SWR"

/** SWR mutation for {@link mutateRefreshLeadContext}: `trigger(request)` answers the result and rejects with the back end failure. */
export const useMutateRefreshLeadContextSwr = (): SWRMutationResponse<
    RefreshLeadContextMutation["refreshLeadContext"],
    Error,
    typeof MUTATE_REFRESH_LEAD_CONTEXT_SWR_KEY,
    RefreshLeadContextArg["arg"]
> =>
    useSWRMutation(MUTATE_REFRESH_LEAD_CONTEXT_SWR_KEY, async (_key: string, { arg }: RefreshLeadContextArg) => {
        const result = await mutateRefreshLeadContext({ request: arg })
        if (!result.data) throw new Error("refreshLeadContext answered no data")
        return result.data.refreshLeadContext
    })
