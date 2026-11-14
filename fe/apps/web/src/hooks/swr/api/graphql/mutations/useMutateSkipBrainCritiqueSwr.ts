"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateSkipBrainCritique,
    type MutateSkipBrainCritiqueRequest,
} from "@/modules/api/graphql/mutations/mutation-skip-brain-critique"
import type { SkipBrainCritiqueMutation } from "@/modules/api"

/** What the SkipBrainCritique mutation is triggered with. */
interface SkipBrainCritiqueArg {
    readonly arg: MutateSkipBrainCritiqueRequest
}

/** The SWR key of the skipBrainCritique mutation. */
export const MUTATE_SKIP_BRAIN_CRITIQUE_SWR_KEY = "MUTATE_SKIP_BRAIN_CRITIQUE_SWR"

/** SWR mutation for {@link mutateSkipBrainCritique}: Skips one point the document critic raised (frees its passage). `trigger(input)` rejects with the back end failure. */
export const useMutateSkipBrainCritiqueSwr = (): SWRMutationResponse<
    SkipBrainCritiqueMutation["skipBrainCritique"],
    Error,
    typeof MUTATE_SKIP_BRAIN_CRITIQUE_SWR_KEY,
    SkipBrainCritiqueArg["arg"]
> =>
    useSWRMutation(MUTATE_SKIP_BRAIN_CRITIQUE_SWR_KEY, async (_key: string, { arg }: SkipBrainCritiqueArg) => {
        const result = await mutateSkipBrainCritique({ request: arg })
        if (!result.data) throw new Error("skipBrainCritique answered no data")
        return result.data.skipBrainCritique
    })
