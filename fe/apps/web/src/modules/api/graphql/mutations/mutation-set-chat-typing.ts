import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SetChatTypingMutation, SetChatTypingMutationVariables } from "../__generated__/graphql"

/** Generated input of the SetChatTyping mutation. */
type MutateSetChatTypingRequest = WireInput<SetChatTypingMutationVariables["input"]>

type MutateSetChatTypingResponse = SetChatTypingMutation

type Document = TypedDocumentNode<MutateSetChatTypingResponse, InputVariables<MutateSetChatTypingRequest>>

const mutation1: Document = gql`
    mutation SetChatTyping($input: SetChatTypingInput!) {
        setChatTyping(input: $input) {
            id
            name
            avatarSeed
            typing
            expiresAt
        }
    }
`

enum MutationSetChatTyping {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSetChatTyping, Document> = { [MutationSetChatTyping.Mutation1]: mutation1 }

/** Parameters of the SetChatTyping mutation. */
type MutateSetChatTypingParams = MutateParams<MutationSetChatTyping, MutateSetChatTypingRequest>

/** Tells the other members of a room that the viewer is typing, or that they stopped. */
export const mutateSetChatTyping = async ({
    mutation = MutationSetChatTyping.Mutation1,
    request,
    signal,
    headers,
}: MutateSetChatTypingParams): Promise<ApolloClient.MutateResult<MutateSetChatTypingResponse>> => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
        context: { headers },
    })
}
