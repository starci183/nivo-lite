import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationRevokeInviteArgs } from "../__generated__/schema"

/** The input of the `revokeInvite` mutation. */
type MutateRevokeInviteRequest = MutationRevokeInviteArgs["input"]

/** The response of the `revokeInvite` mutation: the typed payload straight from the back end contract. */
type MutateRevokeInviteResponse = Pick<Mutation, "revokeInvite">

type Document = TypedDocumentNode<MutateRevokeInviteResponse, InputVariables<MutateRevokeInviteRequest>>

const mutation1: Document = gql`
    mutation RevokeInvite($input: InviteRefInput!) {
        revokeInvite(input: $input)
    }
`

enum MutationRevokeInvite {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRevokeInvite, Document> = {
    [MutationRevokeInvite.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRevokeInvite}. */
type MutateRevokeInviteParams = MutateParams<MutationRevokeInvite, MutateRevokeInviteRequest>

/** Revokes an open invitation (the back end `revokeInvite` mutation). */
export const mutateRevokeInvite = async ({
    mutation = MutationRevokeInvite.Mutation1,
    request,
    signal,
}: MutateRevokeInviteParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
