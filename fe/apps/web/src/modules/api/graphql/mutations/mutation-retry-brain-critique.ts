import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { RetryBrainCritiqueMutation, RetryBrainCritiqueMutationVariables } from "../__generated__/graphql"

/** The response of the `retryBrainCritique` mutation: the typed payload straight from the back end contract. */
type MutateRetryBrainCritiqueResponse = RetryBrainCritiqueMutation

/** The input of the `retryBrainCritique` mutation. */
export type MutateRetryBrainCritiqueRequest = WireInput<RetryBrainCritiqueMutationVariables["input"]>

const mutation1: TypedDocumentNode<MutateRetryBrainCritiqueResponse, InputVariables<MutateRetryBrainCritiqueRequest>> = gql`
    mutation RetryBrainCritique($input: BrainCritiqueSourceInput!) {
        retryBrainCritique(input: $input) {
            attempts
            finishedAt
            reason
            released
            releasedAt
            state
            waitingPassages
        }
    }
`

enum MutationRetryBrainCritique {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRetryBrainCritique, TypedDocumentNode<MutateRetryBrainCritiqueResponse, InputVariables<MutateRetryBrainCritiqueRequest>>> = {
    [MutationRetryBrainCritique.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRetryBrainCritique}. */
type MutateRetryBrainCritiqueParams = MutateParams<MutationRetryBrainCritique, MutateRetryBrainCritiqueRequest>

/**
 * Asks the document critic to read a document again (the back end `retryBrainCritique` mutation).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateRetryBrainCritique = async ({
    mutation = MutationRetryBrainCritique.Mutation1,
    request,
    signal,
}: MutateRetryBrainCritiqueParams): Promise<ApolloClient.MutateResult<MutateRetryBrainCritiqueResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
