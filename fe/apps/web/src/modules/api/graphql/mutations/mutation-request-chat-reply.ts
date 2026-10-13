import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationRequestChatReplyArgs } from "../__generated__/schema"

/** The input of the `requestChatReply` mutation. */
type MutateRequestChatReplyRequest = MutationRequestChatReplyArgs["input"]

/** The response of the `requestChatReply` mutation. */
type MutateRequestChatReplyResponse = Pick<Mutation, "requestChatReply">

type Document = TypedDocumentNode<MutateRequestChatReplyResponse, InputVariables<MutateRequestChatReplyRequest>>

const mutation1: Document = gql`
    mutation RequestChatReply($input: RequestChatReplyInput!) {
        requestChatReply(input: $input) {
            id
            status
            messageId
            delivery
            errorCode
        }
    }
`

enum MutationRequestChatReply {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRequestChatReply, Document> = {
    [MutationRequestChatReply.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRequestChatReply}. */
type MutateRequestChatReplyParams = MutateParams<MutationRequestChatReply, MutateRequestChatReplyRequest>

/** Runs the back end `requestChatReply` mutation with the caller's workspace context. */
export const mutateRequestChatReply = async ({
    mutation = MutationRequestChatReply.Mutation1,
    request,
    signal,
}: MutateRequestChatReplyParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
