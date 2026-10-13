import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationAuthorizeGoogleArgs } from "../__generated__/schema"

/** The input of the `authorizeGoogle` mutation. */
export type MutateAuthorizeGoogleRequest = MutationAuthorizeGoogleArgs["input"]

/** The response of the `authorizeGoogle` mutation. */
type MutateAuthorizeGoogleResponse = Pick<Mutation, "authorizeGoogle">

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
