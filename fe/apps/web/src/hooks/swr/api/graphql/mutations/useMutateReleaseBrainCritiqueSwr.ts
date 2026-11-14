"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateReleaseBrainCritique,
    type MutateReleaseBrainCritiqueRequest,
} from "@/modules/api/graphql/mutations/mutation-release-brain-critique"
import type { ReleaseBrainCritiqueMutation } from "@/modules/api"

/** What the ReleaseBrainCritique mutation is triggered with. */
interface ReleaseBrainCritiqueArg {
    readonly arg: MutateReleaseBrainCritiqueRequest
}

/** The SWR key of the releaseBrainCritique mutation. */
export const MUTATE_RELEASE_BRAIN_CRITIQUE_SWR_KEY = "MUTATE_RELEASE_BRAIN_CRITIQUE_SWR"

/** SWR mutation for {@link mutateReleaseBrainCritique}: Serves to customers the passages of a document that wait only for the critic's review. `trigger(input)` rejects with the back end failure. */
export const useMutateReleaseBrainCritiqueSwr = (): SWRMutationResponse<
    ReleaseBrainCritiqueMutation["releaseBrainCritique"],
    Error,
    typeof MUTATE_RELEASE_BRAIN_CRITIQUE_SWR_KEY,
    ReleaseBrainCritiqueArg["arg"]
> =>
    useSWRMutation(MUTATE_RELEASE_BRAIN_CRITIQUE_SWR_KEY, async (_key: string, { arg }: ReleaseBrainCritiqueArg) => {
        const result = await mutateReleaseBrainCritique({ request: arg })
        if (!result.data) throw new Error("releaseBrainCritique answered no data")
        return result.data.releaseBrainCritique
    })
