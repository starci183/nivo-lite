import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveBrainFactMutation, SaveBrainFactMutationVariables } from "../__generated__/graphql"

/** The response of the `saveBrainFact` mutation: the typed payload straight from the back end contract. */
type MutateSaveBrainFactResponse = SaveBrainFactMutation

/** The input of the `saveBrainFact` mutation. */
export type MutateSaveBrainFactRequest = WireInput<SaveBrainFactMutationVariables["input"]>

const mutation1: TypedDocumentNode<MutateSaveBrainFactResponse, InputVariables<MutateSaveBrainFactRequest>> = gql`
    mutation SaveBrainFact($input: SaveBrainFactInput!) {
        saveBrainFact(input: $input) {
            outcome
            fact {
                id
                status
            }
        }
    }
`

enum MutationSaveBrainFact {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveBrainFact,
    TypedDocumentNode<MutateSaveBrainFactResponse, InputVariables<MutateSaveBrainFactRequest>>
> = {
    [MutationSaveBrainFact.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveBrainFact}. */
type MutateSaveBrainFactParams = MutateParams<MutationSaveBrainFact, MutateSaveBrainFactRequest>

/**
 * Writes a fact of the shared brain (a new value, or a proposal when the write needs a decision) and answers how it landed
 * (the back end `saveBrainFact` mutation). Rejects with the back end failure (`CombinedGraphQLErrors`, message localized
 * by the server).
 */
export const mutateSaveBrainFact = async ({
    mutation = MutationSaveBrainFact.Mutation1,
    request,
    signal,
}: MutateSaveBrainFactParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
