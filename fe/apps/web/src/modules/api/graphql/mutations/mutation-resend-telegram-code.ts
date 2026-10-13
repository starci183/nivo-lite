import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationResendTelegramCodeArgs } from "../__generated__/schema"

/** The input of the `resendTelegramCode` mutation. */
export type MutateResendTelegramCodeRequest = MutationResendTelegramCodeArgs["input"]

/** The response of the `resendTelegramCode` mutation. */
type MutateResendTelegramCodeResponse = Pick<Mutation, "resendTelegramCode">

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
