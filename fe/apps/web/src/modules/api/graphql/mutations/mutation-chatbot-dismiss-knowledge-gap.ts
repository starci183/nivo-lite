import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationDismissKnowledgeGapArgs } from "../__generated__/schema"

/** The input of the `dismissKnowledgeGap` mutation. */
type MutateChatbotDismissKnowledgeGapRequest = MutationDismissKnowledgeGapArgs["input"]

/** The response of the `dismissKnowledgeGap` mutation. */
type MutateChatbotDismissKnowledgeGapResponse = Pick<Mutation, "dismissKnowledgeGap">

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
