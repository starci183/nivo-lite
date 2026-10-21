import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type {
    StartAgentChatConversationMutation,
    StartAgentChatConversationMutationVariables,
} from "../__generated__/graphql"

/** Generated input of the start conversation mutation. */
export type MutateStartAgentChatConversationRequest = WireInput<StartAgentChatConversationMutationVariables["input"]>

/** Generated selection of the start conversation mutation. */
type MutateStartAgentChatConversationResponse = StartAgentChatConversationMutation

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

const mutationMap: Record<MutationStartAgentChatConversation, Document> = {
    [MutationStartAgentChatConversation.Mutation1]: mutation1,
}

/** Parameters of the start conversation mutation. */
type MutateStartAgentChatConversationParams = MutateParams<
    MutationStartAgentChatConversation,
    MutateStartAgentChatConversationRequest
>

/** Opens an owner test or test customer conversation and stores its greeting. */
export const mutateStartAgentChatConversation = async ({
    mutation = MutationStartAgentChatConversation.Mutation1,
    request,
    signal,
    headers,
}: MutateStartAgentChatConversationParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
        context: { headers },
    })
}
