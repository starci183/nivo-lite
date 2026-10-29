import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { ChangePasswordMutation, ChangePasswordMutationVariables } from "../__generated__/graphql"

/** The input of the `changePassword` mutation. */
type MutateChangePasswordRequest = WireInput<ChangePasswordMutationVariables["input"]>

/** The response of the `changePassword` mutation. */
type MutateChangePasswordResponse = ChangePasswordMutation

const mutation1: TypedDocumentNode<MutateChangePasswordResponse, InputVariables<MutateChangePasswordRequest>> = gql`
    mutation ChangePassword($input: ChangePasswordInput!) {
        changePassword(input: $input)
    }
`

enum MutationChangePassword {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationChangePassword,
    TypedDocumentNode<MutateChangePasswordResponse, InputVariables<MutateChangePasswordRequest>>
> = {
    [MutationChangePassword.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateChangePassword}. */
type MutateChangePasswordParams = MutateParams<MutationChangePassword, MutateChangePasswordRequest>

/** Changes the password of the signed-in person after they prove the current one. */
export const mutateChangePassword = async ({
    mutation = MutationChangePassword.Mutation1,
    request,
    signal,
}: MutateChangePasswordParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
