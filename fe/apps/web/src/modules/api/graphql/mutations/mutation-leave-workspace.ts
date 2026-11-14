import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type MutateParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { LeaveWorkspaceMutation } from "../__generated__/graphql"

/** The response of the `leaveWorkspace` mutation: the typed payload straight from the back end contract. */
type MutateLeaveWorkspaceResponse = LeaveWorkspaceMutation

type Document = TypedDocumentNode<MutateLeaveWorkspaceResponse>

const mutation1: Document = gql`
    mutation LeaveWorkspace {
        leaveWorkspace
    }
`

enum MutationLeaveWorkspace {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationLeaveWorkspace, Document> = {
    [MutationLeaveWorkspace.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateLeaveWorkspace}. */
type MutateLeaveWorkspaceParams = Omit<MutateParams<MutationLeaveWorkspace, never>, "request">

/** Takes the signed-in person out of the workspace the `X-Workspace-Id` header names (the back end `leaveWorkspace` mutation). */
export const mutateLeaveWorkspace = async ({
    mutation = MutationLeaveWorkspace.Mutation1,
    signal,
    headers,
}: MutateLeaveWorkspaceParams = {}): Promise<ApolloClient.MutateResult<MutateLeaveWorkspaceResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal, headers })
    return apollo.mutate({ mutation: mutationMap[mutation] })
}
