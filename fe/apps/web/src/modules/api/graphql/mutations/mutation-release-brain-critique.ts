import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { ReleaseBrainCritiqueMutation, ReleaseBrainCritiqueMutationVariables } from "../__generated__/graphql"

/** The response of the `releaseBrainCritique` mutation: the typed payload straight from the back end contract. */
type MutateReleaseBrainCritiqueResponse = ReleaseBrainCritiqueMutation

/** The input of the `releaseBrainCritique` mutation. */
export type MutateReleaseBrainCritiqueRequest = WireInput<ReleaseBrainCritiqueMutationVariables["input"]>

const mutation1: TypedDocumentNode<MutateReleaseBrainCritiqueResponse, InputVariables<MutateReleaseBrainCritiqueRequest>> = gql`
    mutation ReleaseBrainCritique($input: BrainCritiqueSourceInput!) {
        releaseBrainCritique(input: $input) {
            heldPassages
            reasons
            state
            totalPassages
            unreviewedPassages
            withheldPassages
        }
    }
`

enum MutationReleaseBrainCritique {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationReleaseBrainCritique, TypedDocumentNode<MutateReleaseBrainCritiqueResponse, InputVariables<MutateReleaseBrainCritiqueRequest>>> = {
    [MutationReleaseBrainCritique.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateReleaseBrainCritique}. */
type MutateReleaseBrainCritiqueParams = MutateParams<MutationReleaseBrainCritique, MutateReleaseBrainCritiqueRequest>

/**
 * Serves to customers the passages of a document that wait only for the critic's review (the back end `releaseBrainCritique` mutation).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateReleaseBrainCritique = async ({
    mutation = MutationReleaseBrainCritique.Mutation1,
    request,
    signal,
}: MutateReleaseBrainCritiqueParams): Promise<ApolloClient.MutateResult<MutateReleaseBrainCritiqueResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
