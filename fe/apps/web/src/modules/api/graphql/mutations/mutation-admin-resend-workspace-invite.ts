import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type {
    AdminResendWorkspaceInviteMutation,
    AdminResendWorkspaceInviteMutationVariables,
} from "../__generated__/graphql"

/** The input of the `adminResendWorkspaceInvite` mutation. */
export type MutateAdminResendWorkspaceInviteRequest = WireInput<AdminResendWorkspaceInviteMutationVariables["input"]>

/** The response of the `adminResendWorkspaceInvite` mutation. */
type MutateAdminResendWorkspaceInviteResponse = AdminResendWorkspaceInviteMutation

const mutation1: TypedDocumentNode<
    MutateAdminResendWorkspaceInviteResponse,
    InputVariables<MutateAdminResendWorkspaceInviteRequest>
> = gql`
    mutation AdminResendWorkspaceInvite($input: AdminResendWorkspaceInviteInput!) {
        adminResendWorkspaceInvite(input: $input) {
            email
            delivery
        }
    }
`

enum MutationAdminResendWorkspaceInvite {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationAdminResendWorkspaceInvite,
    TypedDocumentNode<MutateAdminResendWorkspaceInviteResponse, InputVariables<MutateAdminResendWorkspaceInviteRequest>>
> = {
    [MutationAdminResendWorkspaceInvite.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateAdminResendWorkspaceInvite}. */
type MutateAdminResendWorkspaceInviteParams = MutateParams<
    MutationAdminResendWorkspaceInvite,
    MutateAdminResendWorkspaceInviteRequest
>

/** Resends a pending workspace invitation (the back end `adminResendWorkspaceInvite` mutation). */
export const mutateAdminResendWorkspaceInvite = async ({
    mutation = MutationAdminResendWorkspaceInvite.Mutation1,
    request,
    signal,
}: MutateAdminResendWorkspaceInviteParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
