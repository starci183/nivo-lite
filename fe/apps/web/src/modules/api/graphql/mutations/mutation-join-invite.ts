import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { JoinInviteMutation, JoinInviteMutationVariables } from "../__generated__/graphql"

/** The input of the `joinInvite` mutation. */
type MutateJoinInviteRequest = WireInput<JoinInviteMutationVariables["input"]>

/** The response of the `joinInvite` mutation: the typed payload straight from the back end contract. */
type MutateJoinInviteResponse = JoinInviteMutation

type Document = TypedDocumentNode<MutateJoinInviteResponse, InputVariables<MutateJoinInviteRequest>>

const mutation1: Document = gql`
    mutation JoinInvite($input: InviteRefInput!) {
        joinInvite(input: $input) {
            workspaceId
        }
    }
`

enum MutationJoinInvite {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationJoinInvite, Document> = {
    [MutationJoinInvite.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateJoinInvite}. */
type MutateJoinInviteParams = MutateParams<MutationJoinInvite, MutateJoinInviteRequest>

/** Accepts, by its id, an invitation addressed to the signed-in person (the back end `joinInvite` mutation). */
export const mutateJoinInvite = async ({
    mutation = MutationJoinInvite.Mutation1,
    request,
    signal,
}: MutateJoinInviteParams): Promise<ApolloClient.MutateResult<MutateJoinInviteResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
