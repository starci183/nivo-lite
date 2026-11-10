"use client"

import useSWRMutation from "swr/mutation"
import { useSWRConfig } from "swr"
import { matchesSwrKey } from "@/modules/utils"
import {
    mutateDecideLeadFreeze,
    type MutateDecideLeadFreezeRequest,
} from "@/modules/api/graphql/mutations/mutation-decide-lead-freeze"
import { QUERY_LEAD_FREEZE_SWR_KEY } from "../queries/useQueryLeadFreezeSwr"
import type { SWRMutationResponse } from "swr/mutation"
import type { DecideLeadFreezeMutation } from "@/modules/api"

/** What the DecideLeadFreeze mutation is triggered with. */
interface DecideLeadFreezeArg {
    readonly arg: MutateDecideLeadFreezeRequest
}

/** The SWR key of {@link useMutateDecideLeadFreezeSwr}. */
export const MUTATE_DECIDE_LEAD_FREEZE_SWR_KEY = "MUTATE_DECIDE_LEAD_FREEZE_SWR"

/** SWR mutation for {@link mutateDecideLeadFreeze}: `trigger(request)` answers the outcome, and the freeze is read again. */
export const useMutateDecideLeadFreezeSwr = (): SWRMutationResponse<
    DecideLeadFreezeMutation["decideLeadFreeze"],
    Error,
    typeof MUTATE_DECIDE_LEAD_FREEZE_SWR_KEY,
    DecideLeadFreezeArg["arg"]
> => {
    const { mutate } = useSWRConfig()
    return useSWRMutation(
        MUTATE_DECIDE_LEAD_FREEZE_SWR_KEY,
        async (_key: string, { arg }: DecideLeadFreezeArg) => {
            const result = await mutateDecideLeadFreeze({ request: arg })
            if (!result.data) throw new Error("decideLeadFreeze answered no data")
            return result.data.decideLeadFreeze
        },
        { onSuccess: () => void mutate(matchesSwrKey(QUERY_LEAD_FREEZE_SWR_KEY)) },
    )
}
