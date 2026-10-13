import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationAdminSetWorkspaceStatusArgs } from "../__generated__/schema"

/** The input of the `adminSetWorkspaceStatus` mutation. */
export type MutateAdminSetWorkspaceStatusRequest = MutationAdminSetWorkspaceStatusArgs["input"]

/** The response of the `adminSetWorkspaceStatus` mutation. */
type MutateAdminSetWorkspaceStatusResponse = Pick<Mutation, "adminSetWorkspaceStatus">

const mutation1: TypedDocumentNode<
    MutateAdminSetWorkspaceStatusResponse,
    InputVariables<MutateAdminSetWorkspaceStatusRequest>
> = gql`
    mutation AdminSetWorkspaceStatus($input: AdminSetWorkspaceStatusInput!) {
        adminSetWorkspaceStatus(input: $input) {
            status
        }
    }
`

enum MutationAdminSetWorkspaceStatus {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationAdminSetWorkspaceStatus,
    TypedDocumentNode<MutateAdminSetWorkspaceStatusResponse, InputVariables<MutateAdminSetWorkspaceStatusRequest>>
> = {
    [MutationAdminSetWorkspaceStatus.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateAdminSetWorkspaceStatus}. */
type MutateAdminSetWorkspaceStatusParams = MutateParams<
    MutationAdminSetWorkspaceStatus,
    MutateAdminSetWorkspaceStatusRequest
>

/** Sets the billing status of a workspace (the back end `adminSetWorkspaceStatus` mutation). */
export const mutateAdminSetWorkspaceStatus = async ({
    mutation = MutationAdminSetWorkspaceStatus.Mutation1,
    request,
    signal,
}: MutateAdminSetWorkspaceStatusParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
