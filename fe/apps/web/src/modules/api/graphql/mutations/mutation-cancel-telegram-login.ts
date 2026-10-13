import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationCancelTelegramLoginArgs } from "../__generated__/schema"

/** The input of the `cancelTelegramLogin` mutation. */
export type MutateCancelTelegramLoginRequest = MutationCancelTelegramLoginArgs["input"]

/** The response of the `cancelTelegramLogin` mutation. */
type MutateCancelTelegramLoginResponse = Pick<Mutation, "cancelTelegramLogin">

const mutation1: TypedDocumentNode<
    MutateCancelTelegramLoginResponse,
    InputVariables<MutateCancelTelegramLoginRequest>
> = gql`
    mutation CancelTelegramLogin($input: CancelTelegramLoginInput!) {
        cancelTelegramLogin(input: $input)
    }
`

enum MutationCancelTelegramLogin {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationCancelTelegramLogin,
    TypedDocumentNode<MutateCancelTelegramLoginResponse, InputVariables<MutateCancelTelegramLoginRequest>>
> = {
    [MutationCancelTelegramLogin.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateCancelTelegramLogin}. */
type CancelTelegramLoginParams = MutateParams<MutationCancelTelegramLogin, MutateCancelTelegramLoginRequest>

/** Cancels a Telegram login in progress. */
export const mutateCancelTelegramLogin = async ({
    mutation = MutationCancelTelegramLogin.Mutation1,
    request,
    signal,
}: CancelTelegramLoginParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
