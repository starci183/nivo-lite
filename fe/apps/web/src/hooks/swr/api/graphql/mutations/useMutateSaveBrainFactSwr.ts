"use client"

import useSWRMutation from "swr/mutation"
import { mutateSaveBrainFact } from "@/modules/api/graphql/mutations/mutation-save-brain-fact"
import type { MutateSaveBrainFactRequest } from "@/modules/api/graphql/mutations/mutation-save-brain-fact"

/** What the SaveBrainFact mutation is triggered with. */
interface SaveBrainFactArg {
    readonly arg: MutateSaveBrainFactRequest
}

/** The SWR key of the saveBrainFact mutation. */
export const MUTATE_SAVE_BRAIN_FACT_SWR_KEY = "MUTATE_SAVE_BRAIN_FACT_SWR"

/** SWR mutation for {@link mutateSaveBrainFact}: Writes a fact of the shared brain and answers the saved fact and its outcome. `trigger(input)` rejects with the back end failure. */
export const useMutateSaveBrainFactSwr = () =>
    useSWRMutation(MUTATE_SAVE_BRAIN_FACT_SWR_KEY, async (_key: string, { arg }: SaveBrainFactArg) => {
        const result = await mutateSaveBrainFact({ request: arg })
        if (!result.data) throw new Error("saveBrainFact answered no data")
        return result.data.saveBrainFact
    })
