import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { StartTelegramLoginMutation, StartTelegramLoginMutationVariables } from "../__generated__/graphql"

/** The input of the `startTelegramLogin` mutation. */
type MutateStartTelegramLoginRequest = WireInput<StartTelegramLoginMutationVariables["input"]>

/** The response of the `startTelegramLogin` mutation. */
type MutateStartTelegramLoginResponse = StartTelegramLoginMutation

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
