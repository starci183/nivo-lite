import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { adminApiTransport } from "@/modules/api-transport"
import type {
    AdminSetWorkspaceStatusMutation,
    AdminSetWorkspaceStatusMutationVariables,
} from "../__generated__/graphql"

/** The input of the `adminSetWorkspaceStatus` mutation. */
export type MutateAdminSetWorkspaceStatusRequest = WireInput<AdminSetWorkspaceStatusMutationVariables["input"]>

/** The response of the `adminSetWorkspaceStatus` mutation. */
type MutateAdminSetWorkspaceStatusResponse = AdminSetWorkspaceStatusMutation

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
}: MutateAdminSetWorkspaceStatusParams): Promise<ApolloClient.MutateResult<MutateAdminSetWorkspaceStatusResponse>> => {
    const apollo = createAuthApolloClient(adminApiTransport, { signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
