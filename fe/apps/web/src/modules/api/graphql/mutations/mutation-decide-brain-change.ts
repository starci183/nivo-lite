import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { DecideBrainChangeMutation, DecideBrainChangeMutationVariables } from "../__generated__/graphql"

/** The response of the `decideBrainChange` mutation: the typed payload straight from the back end contract. */
type MutateDecideBrainChangeResponse = DecideBrainChangeMutation

/** The input of the `decideBrainChange` mutation. */
export type MutateDecideBrainChangeRequest = WireInput<DecideBrainChangeMutationVariables["input"]>

const mutation1: TypedDocumentNode<MutateDecideBrainChangeResponse, InputVariables<MutateDecideBrainChangeRequest>> = gql`
    mutation DecideBrainChange($input: DecideBrainChangeInput!) {
        decideBrainChange(input: $input) {
            outcome
            revision
            state
        }
    }
`

enum MutationDecideBrainChange {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationDecideBrainChange, TypedDocumentNode<MutateDecideBrainChangeResponse, InputVariables<MutateDecideBrainChangeRequest>>> = {
    [MutationDecideBrainChange.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateDecideBrainChange}. */
type MutateDecideBrainChangeParams = MutateParams<MutationDecideBrainChange, MutateDecideBrainChangeRequest>

/**
 * Approves, refuses or keeps both on a proposed change of a truth (the chat change card) (the back end `decideBrainChange` mutation).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateDecideBrainChange = async ({
    mutation = MutationDecideBrainChange.Mutation1,
    request,
    signal,
}: MutateDecideBrainChangeParams): Promise<ApolloClient.MutateResult<MutateDecideBrainChangeResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
