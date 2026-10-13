import useSWRMutation from "swr/mutation"
import { mutateSetKnowledgeSuggestionState } from "@/modules/api/graphql/mutations/mutation-set-knowledge-suggestion-state"
import type { MutateSetKnowledgeSuggestionStateRequest } from "@/modules/api/graphql/mutations/mutation-set-knowledge-suggestion-state"

/** What the SetKnowledgeSuggestionState mutation is triggered with. */
interface SetKnowledgeSuggestionStateArg {
    readonly arg: MutateSetKnowledgeSuggestionStateRequest
}

/** The SWR key of the setKnowledgeSuggestionState mutation. */
export const MUTATE_SET_KNOWLEDGE_SUGGESTION_STATE_SWR_KEY = "MUTATE_SET_KNOWLEDGE_SUGGESTION_STATE_SWR"

/** SWR mutation for {@link mutateSetKnowledgeSuggestionState}: Decides a suggestion: sets it aside or brings it back. `trigger(input)` rejects with the back end failure. */
export const useMutateSetKnowledgeSuggestionStateSwr = () =>
    useSWRMutation(
        MUTATE_SET_KNOWLEDGE_SUGGESTION_STATE_SWR_KEY,
        async (_key: string, { arg }: SetKnowledgeSuggestionStateArg) => {
            const result = await mutateSetKnowledgeSuggestionState({ request: arg })
            if (!result.data) throw new Error("setKnowledgeSuggestionState answered no data")
            return result.data.setKnowledgeSuggestionState
        },
    )
