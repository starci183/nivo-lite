import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationSetChatHandlingArgs } from "../__generated__/schema"

/** The input of the `setChatHandling` mutation. */
type MutateSetChatHandlingRequest = MutationSetChatHandlingArgs["input"]

/** The response of the `setChatHandling` mutation. */
type MutateSetChatHandlingResponse = Pick<Mutation, "setChatHandling">

type Document = TypedDocumentNode<MutateSetChatHandlingResponse, InputVariables<MutateSetChatHandlingRequest>>

const mutation1: Document = gql`
    mutation SetChatHandling($input: SetChatHandlingInput!) {
        setChatHandling(input: $input) {
            conversationId
            handledBy
        }
    }
`

enum MutationSetChatHandling {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSetChatHandling, Document> = {
    [MutationSetChatHandling.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSetChatHandling}. */
type MutateSetChatHandlingParams = MutateParams<MutationSetChatHandling, MutateSetChatHandlingRequest>

/** Runs the back end `setChatHandling` mutation with the caller's workspace context. */
export const mutateSetChatHandling = async ({
    mutation = MutationSetChatHandling.Mutation1,
    request,
    signal,
}: MutateSetChatHandlingParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
