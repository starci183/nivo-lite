import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { ChangeSmtpPasswordMutation, ChangeSmtpPasswordMutationVariables } from "../__generated__/graphql"

/** The input of the `changeSmtpPassword` mutation. */
type MutateChangeSmtpPasswordRequest = WireInput<ChangeSmtpPasswordMutationVariables["input"]>

/** The response of the `changeSmtpPassword` mutation. */
type MutateChangeSmtpPasswordResponse = ChangeSmtpPasswordMutation

const mutation1: TypedDocumentNode<
    MutateChangeSmtpPasswordResponse,
    InputVariables<MutateChangeSmtpPasswordRequest>
> = gql`
    mutation ChangeSmtpPassword($input: ChangeSmtpPasswordInput!) {
        changeSmtpPassword(input: $input)
    }
`

enum MutationChangeSmtpPassword {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationChangeSmtpPassword,
    TypedDocumentNode<MutateChangeSmtpPasswordResponse, InputVariables<MutateChangeSmtpPasswordRequest>>
> = {
    [MutationChangeSmtpPassword.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateChangeSmtpPassword}. */
type MutateChangeSmtpPasswordParams = MutateParams<MutationChangeSmtpPassword, MutateChangeSmtpPasswordRequest>

/** Replaces the password of an SMTP connection. */
export const mutateChangeSmtpPassword = async ({
    mutation = MutationChangeSmtpPassword.Mutation1,
    request,
    signal,
}: MutateChangeSmtpPasswordParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
