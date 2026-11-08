"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateSetModuleLive,
    type MutateSetModuleLiveRequest,
} from "@/modules/api/graphql/mutations/mutation-set-module-live"
import type { SetModuleLiveMutation } from "@/modules/api"

/** What the SetModuleLive mutation is triggered with. */
interface SetModuleLiveArg {
    readonly arg: MutateSetModuleLiveRequest
}

/** The SWR key of {@link useMutateSetModuleLiveSwr}. */
export const MUTATE_SET_MODULE_LIVE_SWR_KEY = "MUTATE_SET_MODULE_LIVE_SWR"

/** SWR mutation for {@link mutateSetModuleLive}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateSetModuleLiveSwr = (): SWRMutationResponse<
    SetModuleLiveMutation["setModuleLive"],
    Error,
    typeof MUTATE_SET_MODULE_LIVE_SWR_KEY,
    SetModuleLiveArg["arg"]
> =>
    useSWRMutation(MUTATE_SET_MODULE_LIVE_SWR_KEY, async (_key: string, { arg }: SetModuleLiveArg) => {
        const result = await mutateSetModuleLive({ request: arg })
        if (!result.data) throw new Error("setModuleLive answered no data")
        return result.data.setModuleLive
    })
