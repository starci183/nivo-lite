import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { DecideBrainFactMutation, DecideBrainFactMutationVariables } from "../__generated__/graphql"

/** The response of the `decideBrainFact` mutation: the typed payload straight from the back end contract. */
type MutateDecideBrainFactResponse = DecideBrainFactMutation

/** The input of the `decideBrainFact` mutation. */
export type MutateDecideBrainFactRequest = WireInput<DecideBrainFactMutationVariables["input"]>

const mutation1: TypedDocumentNode<MutateDecideBrainFactResponse, InputVariables<MutateDecideBrainFactRequest>> = gql`
    mutation DecideBrainFact($input: DecideBrainFactInput!) {
        decideBrainFact(input: $input) {
            id
            status
        }
    }
`

enum MutationDecideBrainFact {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationDecideBrainFact,
    TypedDocumentNode<MutateDecideBrainFactResponse, InputVariables<MutateDecideBrainFactRequest>>
> = {
    [MutationDecideBrainFact.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateDecideBrainFact}. */
type MutateDecideBrainFactParams = MutateParams<MutationDecideBrainFact, MutateDecideBrainFactRequest>

/**
 * Applies, rejects, chooses or retires a fact proposal of the shared brain (the back end `decideBrainFact` mutation).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateDecideBrainFact = async ({
    mutation = MutationDecideBrainFact.Mutation1,
    request,
    signal,
}: MutateDecideBrainFactParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
