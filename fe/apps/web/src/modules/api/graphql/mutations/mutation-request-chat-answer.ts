import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RequestChatAnswerMutation, RequestChatAnswerMutationVariables } from "../__generated__/graphql"

/** The input of the `requestChatAnswer` mutation. */
type MutateRequestChatAnswerRequest = WireInput<RequestChatAnswerMutationVariables["input"]>

/** The response of the `requestChatAnswer` mutation. */
type MutateRequestChatAnswerResponse = RequestChatAnswerMutation

type Document = TypedDocumentNode<MutateRequestChatAnswerResponse, InputVariables<MutateRequestChatAnswerRequest>>

const mutation1: Document = gql`
    mutation RequestChatAnswer($input: RequestChatAnswerInput!) {
        requestChatAnswer(input: $input) {
            id
            status
            messageId
            delivery
            errorCode
        }
    }
`

enum MutationRequestChatAnswer {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRequestChatAnswer, Document> = {
    [MutationRequestChatAnswer.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRequestChatAnswer}. */
type MutateRequestChatAnswerParams = MutateParams<MutationRequestChatAnswer, MutateRequestChatAnswerRequest>

/** Runs the back end `requestChatAnswer` mutation with the caller's workspace context. */
export const mutateRequestChatAnswer = async ({
    mutation = MutationRequestChatAnswer.Mutation1,
    request,
    signal,
}: MutateRequestChatAnswerParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
