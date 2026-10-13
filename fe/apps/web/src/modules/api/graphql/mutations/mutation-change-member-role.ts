import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { ChangeMemberRoleMutation, ChangeMemberRoleMutationVariables } from "../__generated__/graphql"

/** The input of the `changeMemberRole` mutation. */
type MutateChangeMemberRoleRequest = WireInput<ChangeMemberRoleMutationVariables["input"]>

/** The response of the `changeMemberRole` mutation: the typed payload straight from the back end contract. */
type MutateChangeMemberRoleResponse = ChangeMemberRoleMutation

type Document = TypedDocumentNode<MutateChangeMemberRoleResponse, InputVariables<MutateChangeMemberRoleRequest>>

const mutation1: Document = gql`
    mutation ChangeMemberRole($input: ChangeMemberRoleInput!) {
        changeMemberRole(input: $input)
    }
`

enum MutationChangeMemberRole {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationChangeMemberRole, Document> = {
    [MutationChangeMemberRole.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateChangeMemberRole}. */
type MutateChangeMemberRoleParams = MutateParams<MutationChangeMemberRole, MutateChangeMemberRoleRequest>

/** Changes the role of a member (the back end `changeMemberRole` mutation). */
export const mutateChangeMemberRole = async ({
    mutation = MutationChangeMemberRole.Mutation1,
    request,
    signal,
}: MutateChangeMemberRoleParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
