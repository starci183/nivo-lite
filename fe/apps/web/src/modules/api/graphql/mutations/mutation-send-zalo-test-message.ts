import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SendZaloTestMessageMutation, SendZaloTestMessageMutationVariables } from "../__generated__/graphql"

/** The input of the `sendZaloTestMessage` mutation. */
type MutateSendZaloTestMessageRequest = WireInput<SendZaloTestMessageMutationVariables["input"]>

/** The response of the `sendZaloTestMessage` mutation. */
type MutateSendZaloTestMessageResponse = SendZaloTestMessageMutation

const mutation1: TypedDocumentNode<
    MutateSendZaloTestMessageResponse,
    InputVariables<MutateSendZaloTestMessageRequest>
> = gql`
    mutation SendZaloTestMessage($input: SendZaloTestInput!) {
        sendZaloTestMessage(input: $input) {
            sent
            failure
        }
    }
`

enum MutationSendZaloTestMessage {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSendZaloTestMessage,
    TypedDocumentNode<MutateSendZaloTestMessageResponse, InputVariables<MutateSendZaloTestMessageRequest>>
> = {
    [MutationSendZaloTestMessage.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSendZaloTestMessage}. */
type MutateSendZaloTestMessageParams = MutateParams<MutationSendZaloTestMessage, MutateSendZaloTestMessageRequest>

/** Sends a real test text to a Zalo follower. Rejects with the back end failure. */
export const mutateSendZaloTestMessage = async ({
    mutation = MutationSendZaloTestMessage.Mutation1,
    request,
    signal,
}: MutateSendZaloTestMessageParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
