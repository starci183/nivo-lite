"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateDecideBrainFact,
    type MutateDecideBrainFactRequest,
} from "@/modules/api/graphql/mutations/mutation-decide-brain-fact"
import type { SWRMutationResponse } from "swr/mutation"
import type { DecideBrainFactMutation } from "@/modules/api"

/** What the DecideBrainFact mutation is triggered with. */
interface DecideBrainFactArg {
    readonly arg: MutateDecideBrainFactRequest
}

/** The SWR key of the decideBrainFact mutation. */
export const MUTATE_DECIDE_BRAIN_FACT_SWR_KEY = "MUTATE_DECIDE_BRAIN_FACT_SWR"

/** SWR mutation for {@link mutateDecideBrainFact}: Applies, rejects, chooses or retires a fact proposal of the shared brain. `trigger(input)` rejects with the back end failure. */
export const useMutateDecideBrainFactSwr = (): SWRMutationResponse<
    DecideBrainFactMutation["decideBrainFact"],
    Error,
    typeof MUTATE_DECIDE_BRAIN_FACT_SWR_KEY,
    DecideBrainFactArg["arg"]
> =>
    useSWRMutation(MUTATE_DECIDE_BRAIN_FACT_SWR_KEY, async (_key: string, { arg }: DecideBrainFactArg) => {
        const result = await mutateDecideBrainFact({ request: arg })
        if (!result.data) throw new Error("decideBrainFact answered no data")
        return result.data.decideBrainFact
    })
