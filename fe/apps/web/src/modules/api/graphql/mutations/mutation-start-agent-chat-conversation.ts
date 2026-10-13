import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationStartAgentChatConversationArgs } from "../__generated__/schema"

/** Generated input of the start conversation mutation. */
export type MutateStartAgentChatConversationRequest = MutationStartAgentChatConversationArgs["input"]

/** Generated selection of the start conversation mutation. */
type MutateStartAgentChatConversationResponse = Pick<Mutation, "startAgentChatConversation">

type Document = TypedDocumentNode<
    MutateStartAgentChatConversationResponse,
    InputVariables<MutateStartAgentChatConversationRequest>
>

const mutation1: Document = gql`
    mutation StartAgentChatConversation($input: StartAgentChatConversationInput!) {
        startAgentChatConversation(input: $input) {
            id
        }
    }
`

enum MutationStartAgentChatConversation {
    Mutation1 = "mutation1",
}

/** Parameters of the start conversation mutation. */
type MutateStartAgentChatConversationParams = MutateParams<
    MutationStartAgentChatConversation,
    MutateStartAgentChatConversationRequest
>

/** Opens a test or simulated customer conversation and stores its greeting. */
export const mutateStartAgentChatConversation = async ({
    request,
    signal,
    headers,
}: MutateStartAgentChatConversationParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutation1,
        variables: { input: request },
        context: { headers },
    })
}
