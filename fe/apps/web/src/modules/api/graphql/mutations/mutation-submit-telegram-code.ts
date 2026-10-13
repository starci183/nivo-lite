import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationSubmitTelegramCodeArgs } from "../__generated__/schema"

/** The input of the `submitTelegramCode` mutation. */
export type MutateSubmitTelegramCodeRequest = MutationSubmitTelegramCodeArgs["input"]

/** The response of the `submitTelegramCode` mutation. */
type MutateSubmitTelegramCodeResponse = Pick<Mutation, "submitTelegramCode">

const mutation1: TypedDocumentNode<
    MutateSubmitTelegramCodeResponse,
    InputVariables<MutateSubmitTelegramCodeRequest>
> = gql`
    mutation SubmitTelegramCode($input: SubmitTelegramCodeInput!) {
        submitTelegramCode(input: $input) {
            stage
        }
    }
`

enum MutationSubmitTelegramCode {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSubmitTelegramCode,
    TypedDocumentNode<MutateSubmitTelegramCodeResponse, InputVariables<MutateSubmitTelegramCodeRequest>>
> = {
    [MutationSubmitTelegramCode.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSubmitTelegramCode}. */
type SubmitTelegramCodeParams = MutateParams<MutationSubmitTelegramCode, MutateSubmitTelegramCodeRequest>

/** Submits the Telegram login code. */
export const mutateSubmitTelegramCode = async ({
    mutation = MutationSubmitTelegramCode.Mutation1,
    request,
    signal,
}: SubmitTelegramCodeParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
