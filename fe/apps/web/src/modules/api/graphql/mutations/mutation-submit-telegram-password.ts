import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SubmitTelegramPasswordMutation, SubmitTelegramPasswordMutationVariables } from "../__generated__/graphql"

/** The input of the `submitTelegramPassword` mutation. */
export type MutateSubmitTelegramPasswordRequest = WireInput<SubmitTelegramPasswordMutationVariables["input"]>

/** The response of the `submitTelegramPassword` mutation. */
type MutateSubmitTelegramPasswordResponse = SubmitTelegramPasswordMutation

const mutation1: TypedDocumentNode<
    MutateSubmitTelegramPasswordResponse,
    InputVariables<MutateSubmitTelegramPasswordRequest>
> = gql`
    mutation SubmitTelegramPassword($input: SubmitTelegramPasswordInput!) {
        submitTelegramPassword(input: $input) {
            stage
        }
    }
`

enum MutationSubmitTelegramPassword {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSubmitTelegramPassword,
    TypedDocumentNode<MutateSubmitTelegramPasswordResponse, InputVariables<MutateSubmitTelegramPasswordRequest>>
> = {
    [MutationSubmitTelegramPassword.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSubmitTelegramPassword}. */
type SubmitTelegramPasswordParams = MutateParams<MutationSubmitTelegramPassword, MutateSubmitTelegramPasswordRequest>

/** Submits the Telegram two-step password. */
export const mutateSubmitTelegramPassword = async ({
    mutation = MutationSubmitTelegramPassword.Mutation1,
    request,
    signal,
}: SubmitTelegramPasswordParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
