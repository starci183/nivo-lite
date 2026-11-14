import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { SkipBrainCritiqueMutation, SkipBrainCritiqueMutationVariables } from "../__generated__/graphql"

/** The response of the `skipBrainCritique` mutation: the typed payload straight from the back end contract. */
type MutateSkipBrainCritiqueResponse = SkipBrainCritiqueMutation

/** The input of the `skipBrainCritique` mutation. */
export type MutateSkipBrainCritiqueRequest = WireInput<SkipBrainCritiqueMutationVariables["input"]>

const mutation1: TypedDocumentNode<MutateSkipBrainCritiqueResponse, InputVariables<MutateSkipBrainCritiqueRequest>> = gql`
    mutation SkipBrainCritique($input: SkipBrainCritiqueInput!) {
        skipBrainCritique(input: $input) {
            id
            state
            decidedAt
        }
    }
`

enum MutationSkipBrainCritique {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSkipBrainCritique, TypedDocumentNode<MutateSkipBrainCritiqueResponse, InputVariables<MutateSkipBrainCritiqueRequest>>> = {
    [MutationSkipBrainCritique.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSkipBrainCritique}. */
type MutateSkipBrainCritiqueParams = MutateParams<MutationSkipBrainCritique, MutateSkipBrainCritiqueRequest>

/**
 * Skips one point the document critic raised (frees its passage) (the back end `skipBrainCritique` mutation).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateSkipBrainCritique = async ({
    mutation = MutationSkipBrainCritique.Mutation1,
    request,
    signal,
}: MutateSkipBrainCritiqueParams): Promise<ApolloClient.MutateResult<MutateSkipBrainCritiqueResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
