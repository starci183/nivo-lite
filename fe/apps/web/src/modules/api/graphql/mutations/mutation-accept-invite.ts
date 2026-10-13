import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { AcceptInviteMutation, AcceptInviteMutationVariables } from "../__generated__/graphql"

/** The input of the `acceptInvite` mutation. */
type MutateAcceptInviteRequest = WireInput<AcceptInviteMutationVariables["input"]>

/** The response of the `acceptInvite` mutation: the typed payload straight from the back end contract. */
type MutateAcceptInviteResponse = AcceptInviteMutation

type Document = TypedDocumentNode<MutateAcceptInviteResponse, InputVariables<MutateAcceptInviteRequest>>

const mutation1: Document = gql`
    mutation AcceptInvite($input: InviteTokenInput!) {
        acceptInvite(input: $input) {
            workspaceId
        }
    }
`

enum MutationAcceptInvite {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationAcceptInvite, Document> = {
    [MutationAcceptInvite.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateAcceptInvite}. */
type MutateAcceptInviteParams = MutateParams<MutationAcceptInvite, MutateAcceptInviteRequest>

/** Accepts an invitation for the signed-in person (the back end `acceptInvite` mutation). */
export const mutateAcceptInvite = async ({
    mutation = MutationAcceptInvite.Mutation1,
    request,
    signal,
}: MutateAcceptInviteParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
