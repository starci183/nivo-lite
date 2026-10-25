import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { MarkChatReadMutation, MarkChatReadMutationVariables } from "../__generated__/graphql"

/** The input of the `markChatRead` mutation. */
export type MutateMarkChatReadRequest = WireInput<MarkChatReadMutationVariables["input"]>

type MutateMarkChatReadResponse = MarkChatReadMutation

const mutation1: TypedDocumentNode<MutateMarkChatReadResponse, InputVariables<MutateMarkChatReadRequest>> = gql`
    mutation MarkChatRead($input: ChatReceiptInput!) {
        markChatRead(input: $input) {
            ok
        }
    }
`

enum MutationMarkChatRead {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationMarkChatRead,
    TypedDocumentNode<MutateMarkChatReadResponse, InputVariables<MutateMarkChatReadRequest>>
> = {
    [MutationMarkChatRead.Mutation1]: mutation1,
}

/** The back end `markChatRead` mutation. */
export const mutateMarkChatRead = async ({
    mutation = MutationMarkChatRead.Mutation1,
    request,
    signal,
}: MutateParams<MutationMarkChatRead, MutateMarkChatReadRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
