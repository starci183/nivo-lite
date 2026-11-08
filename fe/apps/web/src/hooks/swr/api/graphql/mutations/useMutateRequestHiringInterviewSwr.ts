"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateRequestHiringInterview,
    type MutateRequestHiringInterviewRequest,
} from "@/modules/api/graphql/mutations/mutation-request-hiring-interview"
import type { RequestHiringInterviewMutation } from "@/modules/api"

/** What the requestHiringInterview mutation is triggered with. */
interface RequestHiringInterviewArg {
    readonly arg: MutateRequestHiringInterviewRequest
}

/** The SWR key of the `requestHiringInterview` mutation. */
export const MUTATE_REQUEST_HIRING_INTERVIEW_SWR_KEY = "MUTATE_REQUEST_HIRING_INTERVIEW_SWR"

/** SWR mutation for {@link mutateRequestHiringInterview}: `trigger(request)` answers `requestHiringInterview` and rejects with the back end failure. */
export const useMutateRequestHiringInterviewSwr = (): SWRMutationResponse<
    RequestHiringInterviewMutation["requestHiringInterview"],
    Error,
    typeof MUTATE_REQUEST_HIRING_INTERVIEW_SWR_KEY,
    RequestHiringInterviewArg["arg"]
> =>
    useSWRMutation(
        MUTATE_REQUEST_HIRING_INTERVIEW_SWR_KEY,
        async (_key: string, { arg }: RequestHiringInterviewArg) => {
            const result = await mutateRequestHiringInterview({ request: arg })
            if (!result.data) throw new Error("requestHiringInterview answered no data")
            return result.data.requestHiringInterview
        },
    )
