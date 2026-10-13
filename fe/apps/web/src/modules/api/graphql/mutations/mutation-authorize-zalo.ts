import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { AuthorizeZaloMutation, AuthorizeZaloMutationVariables } from "../__generated__/graphql"

/** The input of the `authorizeZalo` mutation. */
export type MutateAuthorizeZaloRequest = WireInput<AuthorizeZaloMutationVariables["input"]>

/** The response of the `authorizeZalo` mutation. */
type MutateAuthorizeZaloResponse = AuthorizeZaloMutation

const mutation1: TypedDocumentNode<MutateAuthorizeZaloResponse, InputVariables<MutateAuthorizeZaloRequest>> = gql`
    mutation AuthorizeZalo($input: AuthorizeZaloInput!) {
        authorizeZalo(input: $input) {
            url
            callbackUrl
        }
    }
`

enum MutationAuthorizeZalo {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationAuthorizeZalo,
    TypedDocumentNode<MutateAuthorizeZaloResponse, InputVariables<MutateAuthorizeZaloRequest>>
> = {
    [MutationAuthorizeZalo.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateAuthorizeZalo}. */
type MutateAuthorizeZaloParams = MutateParams<MutationAuthorizeZalo, MutateAuthorizeZaloRequest>

/** Starts the Zalo permission page and answers the address to send the browser to. */
export const mutateAuthorizeZalo = async ({
    mutation = MutationAuthorizeZalo.Mutation1,
    request,
    signal,
}: MutateAuthorizeZaloParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
