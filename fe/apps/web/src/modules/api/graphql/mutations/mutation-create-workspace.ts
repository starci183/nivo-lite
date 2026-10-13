import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { CreateWorkspaceMutation, CreateWorkspaceMutationVariables } from "../__generated__/graphql"

/** The input of the `createWorkspace` mutation. */
export type MutateCreateWorkspaceRequest = WireInput<CreateWorkspaceMutationVariables["input"]>

/** The response of the `createWorkspace` mutation. */
type MutateCreateWorkspaceResponse = CreateWorkspaceMutation

const mutation1: TypedDocumentNode<MutateCreateWorkspaceResponse, InputVariables<MutateCreateWorkspaceRequest>> = gql`
    mutation CreateWorkspace($input: CreateWorkspaceInput!) {
        createWorkspace(input: $input) {
            id
        }
    }
`

enum MutationCreateWorkspace {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationCreateWorkspace,
    TypedDocumentNode<MutateCreateWorkspaceResponse, InputVariables<MutateCreateWorkspaceRequest>>
> = {
    [MutationCreateWorkspace.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateCreateWorkspace}. */
type MutateCreateWorkspaceParams = MutateParams<MutationCreateWorkspace, MutateCreateWorkspaceRequest>

/** Creates a free workspace owned by the signed-in person (the back end `createWorkspace` mutation). */
export const mutateCreateWorkspace = async ({
    mutation = MutationCreateWorkspace.Mutation1,
    request,
    signal,
}: MutateCreateWorkspaceParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
