import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationResendInviteArgs } from "../__generated__/schema"

/** The input of the `resendInvite` mutation. */
type MutateResendInviteRequest = MutationResendInviteArgs["input"]

/** The response of the `resendInvite` mutation: the typed payload straight from the back end contract. */
type MutateResendInviteResponse = Pick<Mutation, "resendInvite">

type Document = TypedDocumentNode<MutateResendInviteResponse, InputVariables<MutateResendInviteRequest>>

const mutation1: Document = gql`
    mutation ResendInvite($input: InviteRefInput!) {
        resendInvite(input: $input) {
            delivery
            email
            link
        }
    }
`

enum MutationResendInvite {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationResendInvite, Document> = {
    [MutationResendInvite.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateResendInvite}. */
type MutateResendInviteParams = MutateParams<MutationResendInvite, MutateResendInviteRequest>

/** Sends an invitation again with a fresh link (the back end `resendInvite` mutation). */
export const mutateResendInvite = async ({
    mutation = MutationResendInvite.Mutation1,
    request,
    signal,
}: MutateResendInviteParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
