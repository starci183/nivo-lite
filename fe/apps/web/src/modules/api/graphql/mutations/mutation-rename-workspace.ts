import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { RenameWorkspaceMutation, RenameWorkspaceMutationVariables } from "../__generated__/graphql"

/** The input of the `renameWorkspace` mutation. */
type MutateRenameWorkspaceRequest = WireInput<RenameWorkspaceMutationVariables["input"]>

/** The response of the `renameWorkspace` mutation: the typed payload straight from the back end contract. */
type MutateRenameWorkspaceResponse = RenameWorkspaceMutation

type Document = TypedDocumentNode<MutateRenameWorkspaceResponse, InputVariables<MutateRenameWorkspaceRequest>>

const mutation1: Document = gql`
    mutation RenameWorkspace($input: RenameWorkspaceInput!) {
        renameWorkspace(input: $input)
    }
`

enum MutationRenameWorkspace {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRenameWorkspace, Document> = {
    [MutationRenameWorkspace.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRenameWorkspace}. */
type MutateRenameWorkspaceParams = MutateParams<MutationRenameWorkspace, MutateRenameWorkspaceRequest>

/** Renames the workspace the `X-Workspace-Id` header names (the back end `renameWorkspace` mutation); owner or manager only. */
export const mutateRenameWorkspace = (
    params: MutateRenameWorkspaceParams,
): Promise<ApolloClient.MutateResult<MutateRenameWorkspaceResponse>> =>
    createAuthApolloClient(webApiTransport, { signal: params.signal, headers: params.headers }).mutate({
        mutation: mutationMap[params.mutation ?? MutationRenameWorkspace.Mutation1],
        variables: { input: params.request },
    })
