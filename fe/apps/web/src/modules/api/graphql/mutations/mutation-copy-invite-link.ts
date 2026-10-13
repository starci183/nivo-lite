import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationCopyInviteLinkArgs } from "../__generated__/schema"

/** The input of the `copyInviteLink` mutation. */
type MutateCopyInviteLinkRequest = MutationCopyInviteLinkArgs["input"]

/** The response of the `copyInviteLink` mutation: the typed payload straight from the back end contract. */
type MutateCopyInviteLinkResponse = Pick<Mutation, "copyInviteLink">

type Document = TypedDocumentNode<MutateCopyInviteLinkResponse, InputVariables<MutateCopyInviteLinkRequest>>

const mutation1: Document = gql`
    mutation CopyInviteLink($input: InviteRefInput!) {
        copyInviteLink(input: $input) {
            delivery
            email
            link
        }
    }
`

enum MutationCopyInviteLink {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationCopyInviteLink, Document> = {
    [MutationCopyInviteLink.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateCopyInviteLink}. */
type MutateCopyInviteLinkParams = MutateParams<MutationCopyInviteLink, MutateCopyInviteLinkRequest>

/** Mints a fresh link for an invitation without e-mailing it (the back end `copyInviteLink` mutation). */
export const mutateCopyInviteLink = async ({
    mutation = MutationCopyInviteLink.Mutation1,
    request,
    signal,
}: MutateCopyInviteLinkParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
