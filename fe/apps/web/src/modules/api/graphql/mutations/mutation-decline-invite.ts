import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { DeclineInviteMutation, DeclineInviteMutationVariables } from "../__generated__/graphql"

/** The input of the `declineInvite` mutation. */
type MutateDeclineInviteRequest = WireInput<DeclineInviteMutationVariables["input"]>

/** The response of the `declineInvite` mutation: the typed payload straight from the back end contract. */
type MutateDeclineInviteResponse = DeclineInviteMutation

type Document = TypedDocumentNode<MutateDeclineInviteResponse, InputVariables<MutateDeclineInviteRequest>>

const mutation1: Document = gql`
    mutation DeclineInvite($input: InviteRefInput!) {
        declineInvite(input: $input)
    }
`

enum MutationDeclineInvite {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationDeclineInvite, Document> = {
    [MutationDeclineInvite.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateDeclineInvite}. */
type MutateDeclineInviteParams = MutateParams<MutationDeclineInvite, MutateDeclineInviteRequest>

/** Declines an invitation addressed to the signed-in person (the back end `declineInvite` mutation). */
export const mutateDeclineInvite = async ({
    mutation = MutationDeclineInvite.Mutation1,
    request,
    signal,
}: MutateDeclineInviteParams): Promise<ApolloClient.MutateResult<MutateDeclineInviteResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
