"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateRescreenHiringCandidate,
    type MutateRescreenHiringCandidateRequest,
} from "@/modules/api/graphql/mutations/mutation-rescreen-hiring-candidate"
import type { RescreenHiringCandidateMutation } from "@/modules/api"

/** What the rescreenHiringCandidate mutation is triggered with. */
interface RescreenHiringCandidateArg {
    readonly arg: MutateRescreenHiringCandidateRequest
}

/** The SWR key of the `rescreenHiringCandidate` mutation. */
export const MUTATE_RESCREEN_HIRING_CANDIDATE_SWR_KEY = "MUTATE_RESCREEN_HIRING_CANDIDATE_SWR"

/** SWR mutation for {@link mutateRescreenHiringCandidate}: `trigger(request)` answers `rescreenHiringCandidate` and rejects with the back end failure. */
export const useMutateRescreenHiringCandidateSwr = (): SWRMutationResponse<
    RescreenHiringCandidateMutation["rescreenHiringCandidate"],
    Error,
    typeof MUTATE_RESCREEN_HIRING_CANDIDATE_SWR_KEY,
    RescreenHiringCandidateArg["arg"]
> =>
    useSWRMutation(
        MUTATE_RESCREEN_HIRING_CANDIDATE_SWR_KEY,
        async (_key: string, { arg }: RescreenHiringCandidateArg) => {
            const result = await mutateRescreenHiringCandidate({ request: arg })
            if (!result.data) throw new Error("rescreenHiringCandidate answered no data")
            return result.data.rescreenHiringCandidate
        },
    )
