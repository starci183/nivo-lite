"use client"

import {
    mutateSaveZnsRenewal,
    type mutateSaveZnsRenewal as MutateSaveZnsRenewalOperation,
} from "@/modules/api/graphql/mutations/mutation-save-zns-renewal"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"
import type { SWRMutationResponse } from "swr/mutation"
import type { SaveZnsRenewalMutation } from "@/modules/api"

/** The SWR key of the saveZnsRenewal mutation. */
export const MUTATE_SAVE_ZNS_RENEWAL_SWR_KEY = "MUTATE_SAVE_ZNS_RENEWAL_SWR_KEY"

/** SWR mutation for {@link mutateSaveZnsRenewal}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSaveZnsRenewalSwr = (): SWRMutationResponse<
    SaveZnsRenewalMutation["saveZnsRenewal"],
    Error,
    typeof MUTATE_SAVE_ZNS_RENEWAL_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_SAVE_ZNS_RENEWAL_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSaveZnsRenewal({ request: arg }), MUTATE_SAVE_ZNS_RENEWAL_SWR_KEY).saveZnsRenewal,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateSaveZnsRenewalOperation>[0]["request"]
}
