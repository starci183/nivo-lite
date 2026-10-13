import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SendSmtpTestMutation, SendSmtpTestMutationVariables } from "../__generated__/graphql"

/** The input of the `sendSmtpTest` mutation. */
export type MutateSendSmtpTestRequest = WireInput<SendSmtpTestMutationVariables["input"]>

/** The response of the `sendSmtpTest` mutation. */
type MutateSendSmtpTestResponse = SendSmtpTestMutation

const mutation1: TypedDocumentNode<MutateSendSmtpTestResponse, InputVariables<MutateSendSmtpTestRequest>> = gql`
    mutation SendSmtpTest($input: SendSmtpTestInput!) {
        sendSmtpTest(input: $input) {
            to
            isDefault
        }
    }
`

enum MutationSendSmtpTest {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSendSmtpTest,
    TypedDocumentNode<MutateSendSmtpTestResponse, InputVariables<MutateSendSmtpTestRequest>>
> = {
    [MutationSendSmtpTest.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSendSmtpTest}. */
type MutateSendSmtpTestParams = MutateParams<MutationSendSmtpTest, MutateSendSmtpTestRequest>

/** Sends a real test email through an SMTP connection. */
export const mutateSendSmtpTest = async ({
    mutation = MutationSendSmtpTest.Mutation1,
    request,
    signal,
}: MutateSendSmtpTestParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
