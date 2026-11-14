"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateSaveCrmConnection,
    type MutateSaveCrmConnectionRequest,
} from "@/modules/api/graphql/mutations/mutation-save-crm-connection"
import type { SaveCrmConnectionMutation } from "@/modules/api"

/** What the saveCrmConnection mutation is triggered with. */
interface SaveCrmConnectionArg {
    readonly arg: MutateSaveCrmConnectionRequest
}

/** The SWR key of the saveCrmConnection mutation. */
export const MUTATE_SAVE_CRM_CONNECTION_SWR_KEY = "MUTATE_SAVE_CRM_CONNECTION_SWR"

/** SWR mutation for {@link mutateSaveCrmConnection}: `trigger(input)` answers what saving came to and rejects with the back end failure. */
export const useMutateSaveCrmConnectionSwr = (): SWRMutationResponse<
    SaveCrmConnectionMutation["saveCrmConnection"],
    Error,
    typeof MUTATE_SAVE_CRM_CONNECTION_SWR_KEY,
    SaveCrmConnectionArg["arg"]
> =>
    useSWRMutation(MUTATE_SAVE_CRM_CONNECTION_SWR_KEY, async (_key: string, { arg }: SaveCrmConnectionArg) => {
        const result = await mutateSaveCrmConnection({ request: arg })
        if (result.data === undefined) throw new Error("saveCrmConnection answered no data")
        return result.data.saveCrmConnection
    })
