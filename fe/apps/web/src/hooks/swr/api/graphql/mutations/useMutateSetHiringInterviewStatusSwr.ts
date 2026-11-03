"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateSetHiringInterviewStatus,
    type MutateSetHiringInterviewStatusRequest,
} from "@/modules/api/graphql/mutations/mutation-set-hiring-interview-status"
import type { SWRMutationResponse } from "swr/mutation"
import type { SetHiringInterviewStatusMutation } from "@/modules/api"

/** What the setHiringInterviewStatus mutation is triggered with. */
interface SetHiringInterviewStatusArg {
    readonly arg: MutateSetHiringInterviewStatusRequest
}

/** The SWR key of the `setHiringInterviewStatus` mutation. */
export const MUTATE_SET_HIRING_INTERVIEW_STATUS_SWR_KEY = "MUTATE_SET_HIRING_INTERVIEW_STATUS_SWR"

/** SWR mutation for {@link mutateSetHiringInterviewStatus}: `trigger(request)` answers `setHiringInterviewStatus` and rejects with the back end failure. */
export const useMutateSetHiringInterviewStatusSwr = (): SWRMutationResponse<
    SetHiringInterviewStatusMutation["setHiringInterviewStatus"],
    Error,
    typeof MUTATE_SET_HIRING_INTERVIEW_STATUS_SWR_KEY,
    SetHiringInterviewStatusArg["arg"]
> =>
    useSWRMutation(
        MUTATE_SET_HIRING_INTERVIEW_STATUS_SWR_KEY,
        async (_key: string, { arg }: SetHiringInterviewStatusArg) => {
            const result = await mutateSetHiringInterviewStatus({ request: arg })
            if (!result.data) throw new Error("setHiringInterviewStatus answered no data")
            return result.data.setHiringInterviewStatus
        },
    )
