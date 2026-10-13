import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { AuthorizeDriveMutation, AuthorizeDriveMutationVariables } from "../__generated__/graphql"

/** The input of the `authorizeDrive` mutation. */
export type MutateAuthorizeDriveRequest = WireInput<AuthorizeDriveMutationVariables["input"]>

/** The response of the `authorizeDrive` mutation. */
type MutateAuthorizeDriveResponse = AuthorizeDriveMutation

const mutation1: TypedDocumentNode<MutateAuthorizeDriveResponse, InputVariables<MutateAuthorizeDriveRequest>> = gql`
    mutation AuthorizeDrive($input: AuthorizeDriveInput!) {
        authorizeDrive(input: $input) {
            url
        }
    }
`

enum MutationAuthorizeDrive {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationAuthorizeDrive,
    TypedDocumentNode<MutateAuthorizeDriveResponse, InputVariables<MutateAuthorizeDriveRequest>>
> = {
    [MutationAuthorizeDrive.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateAuthorizeDrive}. */
type MutateAuthorizeDriveParams = MutateParams<MutationAuthorizeDrive, MutateAuthorizeDriveRequest>

/** Starts the Google Drive read consent and answers the address to send the browser to (it comes back with `?drive=ok|error`). */
export const mutateAuthorizeDrive = async ({
    mutation = MutationAuthorizeDrive.Mutation1,
    request,
    signal,
}: MutateAuthorizeDriveParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
