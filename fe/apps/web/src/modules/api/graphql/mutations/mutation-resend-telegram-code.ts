import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { ResendTelegramCodeMutation, ResendTelegramCodeMutationVariables } from "../__generated__/graphql"

/** The input of the `resendTelegramCode` mutation. */
export type MutateResendTelegramCodeRequest = WireInput<ResendTelegramCodeMutationVariables["input"]>

/** The response of the `resendTelegramCode` mutation. */
type MutateResendTelegramCodeResponse = ResendTelegramCodeMutation

const mutation1: TypedDocumentNode<
    MutateResendTelegramCodeResponse,
    InputVariables<MutateResendTelegramCodeRequest>
> = gql`
    mutation ResendTelegramCode($input: ResendTelegramCodeInput!) {
        resendTelegramCode(input: $input)
    }
`

enum MutationResendTelegramCode {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationResendTelegramCode,
    TypedDocumentNode<MutateResendTelegramCodeResponse, InputVariables<MutateResendTelegramCodeRequest>>
> = {
    [MutationResendTelegramCode.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateResendTelegramCode}. */
type ResendTelegramCodeParams = MutateParams<MutationResendTelegramCode, MutateResendTelegramCodeRequest>

/** Asks Telegram for a fresh login code. */
export const mutateResendTelegramCode = async ({
    mutation = MutationResendTelegramCode.Mutation1,
    request,
    signal,
}: ResendTelegramCodeParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
