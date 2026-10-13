import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SendAgentChatMessageMutation, SendAgentChatMessageMutationVariables } from "../__generated__/graphql"

/** Generated input of the queued message mutation. */
export type MutateSendAgentChatMessageRequest = WireInput<SendAgentChatMessageMutationVariables["input"]>

/** Generated selection of the queued message mutation. */
type MutateSendAgentChatMessageResponse = SendAgentChatMessageMutation

type Document = TypedDocumentNode<MutateSendAgentChatMessageResponse, InputVariables<MutateSendAgentChatMessageRequest>>

const mutation1: Document = gql`
    mutation SendAgentChatMessage($input: SendAgentChatMessageInput!) {
        sendAgentChatMessage(input: $input) {
            id
            conversationId
            status
        }
    }
`

enum MutationSendAgentChatMessage {
    Mutation1 = "mutation1",
}

/** Parameters of the queued message mutation. */
type MutateSendAgentChatMessageParams = MutateParams<MutationSendAgentChatMessage, MutateSendAgentChatMessageRequest>

/** Stores a message and queues its turn; status is read separately. */
export const mutateSendAgentChatMessage = async ({ request, signal, headers }: MutateSendAgentChatMessageParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutation1,
        variables: { input: request },
        context: { headers },
    })
}
