import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { DeleteWorkspaceMutation, DeleteWorkspaceMutationVariables } from "../__generated__/graphql"

/** The input of the `deleteWorkspace` mutation. */
type MutateDeleteWorkspaceRequest = WireInput<DeleteWorkspaceMutationVariables["input"]>

/** The response of the `deleteWorkspace` mutation: the typed payload straight from the back end contract. */
type MutateDeleteWorkspaceResponse = DeleteWorkspaceMutation

type Document = TypedDocumentNode<MutateDeleteWorkspaceResponse, InputVariables<MutateDeleteWorkspaceRequest>>

const mutation1: Document = gql`
    mutation DeleteWorkspace($input: DeleteWorkspaceInput!) {
        deleteWorkspace(input: $input)
    }
`

enum MutationDeleteWorkspace {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationDeleteWorkspace, Document> = {
    [MutationDeleteWorkspace.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateDeleteWorkspace}. */
type MutateDeleteWorkspaceParams = MutateParams<MutationDeleteWorkspace, MutateDeleteWorkspaceRequest>

/** Deletes the workspace the `X-Workspace-Id` header names once its owner typed its name (the back end `deleteWorkspace` mutation). */
export const mutateDeleteWorkspace = (
    params: MutateDeleteWorkspaceParams,
): Promise<ApolloClient.MutateResult<MutateDeleteWorkspaceResponse>> =>
    createAuthApolloClient({ signal: params.signal, headers: params.headers }).mutate({
        mutation: mutationMap[params.mutation ?? MutationDeleteWorkspace.Mutation1],
        variables: { input: params.request },
    })
