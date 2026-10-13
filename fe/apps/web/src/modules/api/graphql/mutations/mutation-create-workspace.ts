import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationCreateWorkspaceArgs } from "../__generated__/schema"

/** The input of the `createWorkspace` mutation. */
export type MutateCreateWorkspaceRequest = MutationCreateWorkspaceArgs["input"]

/** The response of the `createWorkspace` mutation. */
type MutateCreateWorkspaceResponse = Pick<Mutation, "createWorkspace">

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
