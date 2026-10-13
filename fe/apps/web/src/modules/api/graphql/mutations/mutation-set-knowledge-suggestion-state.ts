import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type {
    SetKnowledgeSuggestionStateMutation,
    SetKnowledgeSuggestionStateMutationVariables,
} from "../__generated__/graphql"

/** The response of the `setKnowledgeSuggestionState` mutation: the typed payload straight from the back end contract. */
type MutateSetKnowledgeSuggestionStateResponse = SetKnowledgeSuggestionStateMutation

/** The input of the `setKnowledgeSuggestionState` mutation. */
export type MutateSetKnowledgeSuggestionStateRequest = WireInput<SetKnowledgeSuggestionStateMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateSetKnowledgeSuggestionStateResponse,
    InputVariables<MutateSetKnowledgeSuggestionStateRequest>
> = gql`
    mutation SetKnowledgeSuggestionState($input: SetKnowledgeSuggestionStateInput!) {
        setKnowledgeSuggestionState(input: $input)
    }
`

enum MutationSetKnowledgeSuggestionState {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSetKnowledgeSuggestionState,
    TypedDocumentNode<
        MutateSetKnowledgeSuggestionStateResponse,
        InputVariables<MutateSetKnowledgeSuggestionStateRequest>
    >
> = {
    [MutationSetKnowledgeSuggestionState.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSetKnowledgeSuggestionState}. */
type MutateSetKnowledgeSuggestionStateParams = MutateParams<
    MutationSetKnowledgeSuggestionState,
    MutateSetKnowledgeSuggestionStateRequest
>

/**
 * Decides a suggestion of the documents page: sets it aside (dismissed, not applicable) or brings it back when the state
 * is absent (the back end `setKnowledgeSuggestionState` mutation). Rejects with the back end failure
 * (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateSetKnowledgeSuggestionState = async ({
    mutation = MutationSetKnowledgeSuggestionState.Mutation1,
    request,
    signal,
}: MutateSetKnowledgeSuggestionStateParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
