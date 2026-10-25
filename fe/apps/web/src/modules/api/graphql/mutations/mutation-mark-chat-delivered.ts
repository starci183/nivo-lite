import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { MarkChatDeliveredMutation, MarkChatDeliveredMutationVariables } from "../__generated__/graphql"

/** The input of the `markChatDelivered` mutation. */
export type MutateMarkChatDeliveredRequest = WireInput<MarkChatDeliveredMutationVariables["input"]>

type MutateMarkChatDeliveredResponse = MarkChatDeliveredMutation

const mutation1: TypedDocumentNode<
    MutateMarkChatDeliveredResponse,
    InputVariables<MutateMarkChatDeliveredRequest>
> = gql`
    mutation MarkChatDelivered($input: ChatReceiptInput!) {
        markChatDelivered(input: $input) {
            ok
        }
    }
`

enum MutationMarkChatDelivered {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationMarkChatDelivered,
    TypedDocumentNode<MutateMarkChatDeliveredResponse, InputVariables<MutateMarkChatDeliveredRequest>>
> = {
    [MutationMarkChatDelivered.Mutation1]: mutation1,
}

/** The back end `markChatDelivered` mutation. */
export const mutateMarkChatDelivered = async ({
    mutation = MutationMarkChatDelivered.Mutation1,
    request,
    signal,
}: MutateParams<MutationMarkChatDelivered, MutateMarkChatDeliveredRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
