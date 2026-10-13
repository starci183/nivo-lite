import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationTakeOverAgentChatConversationArgs } from "../__generated__/schema"

/** Generated input of the human takeover mutation. */
export type MutateTakeOverAgentChatConversationRequest = MutationTakeOverAgentChatConversationArgs["input"]

/** Generated selection of the human takeover mutation. */
type MutateTakeOverAgentChatConversationResponse = Pick<Mutation, "takeOverAgentChatConversation">

type Document = TypedDocumentNode<
    MutateTakeOverAgentChatConversationResponse,
    InputVariables<MutateTakeOverAgentChatConversationRequest>
>

const mutation1: Document = gql`
    mutation TakeOverAgentChatConversation($input: TakeOverAgentChatConversationInput!) {
        takeOverAgentChatConversation(input: $input) {
            conversationId
            handledBy
        }
    }
`

enum MutationTakeOverAgentChatConversation {
    Mutation1 = "mutation1",
}

/** Parameters of the human takeover mutation. */
type MutateTakeOverAgentChatConversationParams = MutateParams<
    MutationTakeOverAgentChatConversation,
    MutateTakeOverAgentChatConversationRequest
>

/** Gives the conversation to a human or returns it to the agent. */
export const mutateTakeOverAgentChatConversation = async ({
    request,
    signal,
    headers,
}: MutateTakeOverAgentChatConversationParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({ mutation: mutation1, variables: { input: request }, context: { headers } })
}
