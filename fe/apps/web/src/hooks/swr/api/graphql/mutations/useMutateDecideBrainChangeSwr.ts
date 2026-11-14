"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateDecideBrainChange,
    type MutateDecideBrainChangeRequest,
} from "@/modules/api/graphql/mutations/mutation-decide-brain-change"
import type { DecideBrainChangeMutation } from "@/modules/api"

/** What the DecideBrainChange mutation is triggered with. */
interface DecideBrainChangeArg {
    readonly arg: MutateDecideBrainChangeRequest
}

/** The SWR key of the decideBrainChange mutation. */
export const MUTATE_DECIDE_BRAIN_CHANGE_SWR_KEY = "MUTATE_DECIDE_BRAIN_CHANGE_SWR"

/** SWR mutation for {@link mutateDecideBrainChange}: Approves, refuses or keeps both on a proposed change of a truth (the chat change card). `trigger(input)` rejects with the back end failure. */
export const useMutateDecideBrainChangeSwr = (): SWRMutationResponse<
    DecideBrainChangeMutation["decideBrainChange"],
    Error,
    typeof MUTATE_DECIDE_BRAIN_CHANGE_SWR_KEY,
    DecideBrainChangeArg["arg"]
> =>
    useSWRMutation(MUTATE_DECIDE_BRAIN_CHANGE_SWR_KEY, async (_key: string, { arg }: DecideBrainChangeArg) => {
        const result = await mutateDecideBrainChange({ request: arg })
        if (!result.data) throw new Error("decideBrainChange answered no data")
        return result.data.decideBrainChange
    })
