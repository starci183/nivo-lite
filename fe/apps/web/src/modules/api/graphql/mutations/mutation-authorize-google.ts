import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { AuthorizeGoogleMutation, AuthorizeGoogleMutationVariables } from "../__generated__/graphql"

/** The input of the `authorizeGoogle` mutation. */
export type MutateAuthorizeGoogleRequest = WireInput<AuthorizeGoogleMutationVariables["input"]>

/** The response of the `authorizeGoogle` mutation. */
type MutateAuthorizeGoogleResponse = AuthorizeGoogleMutation

const mutation1: TypedDocumentNode<MutateAuthorizeGoogleResponse, InputVariables<MutateAuthorizeGoogleRequest>> = gql`
    mutation AuthorizeGoogle($input: AuthorizeGoogleInput!) {
        authorizeGoogle(input: $input) {
            url
        }
    }
`

enum MutationAuthorizeGoogle {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationAuthorizeGoogle,
    TypedDocumentNode<MutateAuthorizeGoogleResponse, InputVariables<MutateAuthorizeGoogleRequest>>
> = {
    [MutationAuthorizeGoogle.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateAuthorizeGoogle}. */
type MutateAuthorizeGoogleParams = MutateParams<MutationAuthorizeGoogle, MutateAuthorizeGoogleRequest>

/** Starts the Google consent and answers the address to send the browser to. */
export const mutateAuthorizeGoogle = async ({
    mutation = MutationAuthorizeGoogle.Mutation1,
    request,
    signal,
}: MutateAuthorizeGoogleParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
