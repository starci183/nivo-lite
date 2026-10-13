import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { AuthorizeMetaMutation, AuthorizeMetaMutationVariables } from "../__generated__/graphql"

/** The input of the `authorizeMeta` mutation. */
type MutateAuthorizeMetaRequest = WireInput<AuthorizeMetaMutationVariables["input"]>

/** The response of the `authorizeMeta` mutation. */
type MutateAuthorizeMetaResponse = AuthorizeMetaMutation

const mutation1: TypedDocumentNode<MutateAuthorizeMetaResponse, InputVariables<MutateAuthorizeMetaRequest>> = gql`
    mutation AuthorizeMeta($input: AuthorizeMetaInput!) {
        authorizeMeta(input: $input) {
            connectionId
            url
        }
    }
`

enum MutationAuthorizeMeta {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationAuthorizeMeta,
    TypedDocumentNode<MutateAuthorizeMetaResponse, InputVariables<MutateAuthorizeMetaRequest>>
> = {
    [MutationAuthorizeMeta.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateAuthorizeMeta}. */
type MutateAuthorizeMetaParams = MutateParams<MutationAuthorizeMeta, MutateAuthorizeMetaRequest>

/** Starts the Facebook login and answers the address to send the browser to. */
export const mutateAuthorizeMeta = async ({
    mutation = MutationAuthorizeMeta.Mutation1,
    request,
    signal,
}: MutateAuthorizeMetaParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
