import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationStartTelegramLoginArgs } from "../__generated__/schema"

/** The input of the `startTelegramLogin` mutation. */
export type MutateStartTelegramLoginRequest = MutationStartTelegramLoginArgs["input"]

/** The response of the `startTelegramLogin` mutation. */
type MutateStartTelegramLoginResponse = Pick<Mutation, "startTelegramLogin">

const mutation1: TypedDocumentNode<
    MutateStartTelegramLoginResponse,
    InputVariables<MutateStartTelegramLoginRequest>
> = gql`
    mutation StartTelegramLogin($input: StartTelegramLoginInput!) {
        startTelegramLogin(input: $input) {
            connectionId
            viaApp
        }
    }
`

enum MutationStartTelegramLogin {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationStartTelegramLogin,
    TypedDocumentNode<MutateStartTelegramLoginResponse, InputVariables<MutateStartTelegramLoginRequest>>
> = {
    [MutationStartTelegramLogin.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateStartTelegramLogin}. */
type StartTelegramLoginParams = MutateParams<MutationStartTelegramLogin, MutateStartTelegramLoginRequest>

/** Sends the personal Telegram login code. */
export const mutateStartTelegramLogin = async ({
    mutation = MutationStartTelegramLogin.Mutation1,
    request,
    signal,
}: StartTelegramLoginParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
