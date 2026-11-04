"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateSuggestLeadOwner,
    type MutateSuggestLeadOwnerRequest,
} from "@/modules/api/graphql/mutations/mutation-suggest-lead-owner"
import type { SWRMutationResponse } from "swr/mutation"
import type { SuggestLeadOwnerMutation } from "@/modules/api"

/** What the suggestLeadOwner mutation is triggered with. */
interface SuggestLeadOwnerArg {
    readonly arg: MutateSuggestLeadOwnerRequest
}

/** The SWR key of the suggestLeadOwner mutation. */
export const MUTATE_SUGGEST_LEAD_OWNER_SWR_KEY = "MUTATE_SUGGEST_LEAD_OWNER_SWR"

/** SWR mutation for {@link mutateSuggestLeadOwner}: `trigger(request)` answers the result and rejects with the back end failure. */
export const useMutateSuggestLeadOwnerSwr = (): SWRMutationResponse<
    SuggestLeadOwnerMutation["suggestLeadOwner"],
    Error,
    typeof MUTATE_SUGGEST_LEAD_OWNER_SWR_KEY,
    SuggestLeadOwnerArg["arg"]
> =>
    useSWRMutation(MUTATE_SUGGEST_LEAD_OWNER_SWR_KEY, async (_key: string, { arg }: SuggestLeadOwnerArg) => {
        const result = await mutateSuggestLeadOwner({ request: arg })
        if (!result.data) throw new Error("suggestLeadOwner answered no data")
        return result.data.suggestLeadOwner
    })
