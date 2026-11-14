"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateAnswerBrainCritique,
    type MutateAnswerBrainCritiqueRequest,
} from "@/modules/api/graphql/mutations/mutation-answer-brain-critique"
import type { AnswerBrainCritiqueMutation } from "@/modules/api"

/** What the AnswerBrainCritique mutation is triggered with. */
interface AnswerBrainCritiqueArg {
    readonly arg: MutateAnswerBrainCritiqueRequest
}

/** The SWR key of the answerBrainCritique mutation. */
export const MUTATE_ANSWER_BRAIN_CRITIQUE_SWR_KEY = "MUTATE_ANSWER_BRAIN_CRITIQUE_SWR"

/** SWR mutation for {@link mutateAnswerBrainCritique}: Answers one point the document critic raised: a choice, a typed value or a free answer. `trigger(input)` rejects with the back end failure. */
export const useMutateAnswerBrainCritiqueSwr = (): SWRMutationResponse<
    AnswerBrainCritiqueMutation["answerBrainCritique"],
    Error,
    typeof MUTATE_ANSWER_BRAIN_CRITIQUE_SWR_KEY,
    AnswerBrainCritiqueArg["arg"]
> =>
    useSWRMutation(MUTATE_ANSWER_BRAIN_CRITIQUE_SWR_KEY, async (_key: string, { arg }: AnswerBrainCritiqueArg) => {
        const result = await mutateAnswerBrainCritique({ request: arg })
        if (!result.data) throw new Error("answerBrainCritique answered no data")
        return result.data.answerBrainCritique
    })
