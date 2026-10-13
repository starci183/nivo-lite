import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { CreateInviteMutation, CreateInviteMutationVariables } from "../__generated__/graphql"

/** The input of the `createInvite` mutation. */
type MutateCreateInviteRequest = WireInput<CreateInviteMutationVariables["input"]>

/** The response of the `createInvite` mutation: the typed payload straight from the back end contract. */
type MutateCreateInviteResponse = CreateInviteMutation

type Document = TypedDocumentNode<MutateCreateInviteResponse, InputVariables<MutateCreateInviteRequest>>

const mutation1: Document = gql`
    mutation CreateInvite($input: CreateInviteInput!) {
        createInvite(input: $input) {
            delivery
            email
            link
        }
    }
`

enum MutationCreateInvite {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationCreateInvite, Document> = {
    [MutationCreateInvite.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateCreateInvite}. */
type MutateCreateInviteParams = MutateParams<MutationCreateInvite, MutateCreateInviteRequest>

/** Invites someone by e-mail to the active workspace (the back end `createInvite` mutation). */
export const mutateCreateInvite = async ({
    mutation = MutationCreateInvite.Mutation1,
    request,
    signal,
}: MutateCreateInviteParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
