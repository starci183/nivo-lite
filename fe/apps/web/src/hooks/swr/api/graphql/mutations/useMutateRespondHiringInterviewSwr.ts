"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateRespondHiringInterview,
    type MutateRespondHiringInterviewRequest,
} from "@/modules/api/graphql/mutations/mutation-respond-hiring-interview"
import type { SWRMutationResponse } from "swr/mutation"
import type { RespondHiringInterviewMutation } from "@/modules/api"

/** What the respondHiringInterview mutation is triggered with. */
interface RespondHiringInterviewArg {
    readonly arg: MutateRespondHiringInterviewRequest
}

/** The SWR key of the `respondHiringInterview` mutation. */
export const MUTATE_RESPOND_HIRING_INTERVIEW_SWR_KEY = "MUTATE_RESPOND_HIRING_INTERVIEW_SWR"

/** SWR mutation for {@link mutateRespondHiringInterview}: `trigger(request)` answers `respondHiringInterview` and rejects with the back end failure. */
export const useMutateRespondHiringInterviewSwr = (): SWRMutationResponse<
    RespondHiringInterviewMutation["respondHiringInterview"],
    Error,
    typeof MUTATE_RESPOND_HIRING_INTERVIEW_SWR_KEY,
    RespondHiringInterviewArg["arg"]
> =>
    useSWRMutation(
        MUTATE_RESPOND_HIRING_INTERVIEW_SWR_KEY,
        async (_key: string, { arg }: RespondHiringInterviewArg) => {
            const result = await mutateRespondHiringInterview({ request: arg })
            if (!result.data) throw new Error("respondHiringInterview answered no data")
            return result.data.respondHiringInterview
        },
    )
