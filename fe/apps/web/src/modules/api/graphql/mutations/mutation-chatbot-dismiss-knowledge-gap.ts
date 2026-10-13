import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type {
    ChatbotDismissKnowledgeGapMutation,
    ChatbotDismissKnowledgeGapMutationVariables,
} from "../__generated__/graphql"

/** The input of the `dismissKnowledgeGap` mutation. */
type MutateChatbotDismissKnowledgeGapRequest = WireInput<ChatbotDismissKnowledgeGapMutationVariables["input"]>

/** The response of the `dismissKnowledgeGap` mutation. */
type MutateChatbotDismissKnowledgeGapResponse = ChatbotDismissKnowledgeGapMutation

type Document = TypedDocumentNode<
    MutateChatbotDismissKnowledgeGapResponse,
    InputVariables<MutateChatbotDismissKnowledgeGapRequest>
>

const mutation1: Document = gql`
    mutation ChatbotDismissKnowledgeGap($input: DismissKnowledgeGapInput!) {
        dismissKnowledgeGap(input: $input)
    }
`

enum MutationChatbotDismissKnowledgeGap {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationChatbotDismissKnowledgeGap, Document> = {
    [MutationChatbotDismissKnowledgeGap.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateChatbotDismissKnowledgeGap}. */
type MutateChatbotDismissKnowledgeGapParams = MutateParams<
    MutationChatbotDismissKnowledgeGap,
    MutateChatbotDismissKnowledgeGapRequest
>

/** Runs the back end `dismissKnowledgeGap` mutation with the caller's workspace context. */
export const mutateChatbotDismissKnowledgeGap = async ({
    mutation = MutationChatbotDismissKnowledgeGap.Mutation1,
    request,
    signal,
}: MutateChatbotDismissKnowledgeGapParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
