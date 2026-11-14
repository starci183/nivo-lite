import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { SubmitTelegramCodeMutation, SubmitTelegramCodeMutationVariables } from "../__generated__/graphql"

/** The input of the `submitTelegramCode` mutation. */
type MutateSubmitTelegramCodeRequest = WireInput<SubmitTelegramCodeMutationVariables["input"]>

/** The response of the `submitTelegramCode` mutation. */
type MutateSubmitTelegramCodeResponse = SubmitTelegramCodeMutation

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
}: SubmitTelegramCodeParams): Promise<ApolloClient.MutateResult<MutateSubmitTelegramCodeResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
