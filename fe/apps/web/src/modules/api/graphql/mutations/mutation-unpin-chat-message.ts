import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { UnpinChatMessageMutation, UnpinChatMessageMutationVariables } from "../__generated__/graphql"

/** Generated input of the UnpinChatMessage mutation. */
type MutateUnpinChatMessageRequest = WireInput<UnpinChatMessageMutationVariables["input"]>

type MutateUnpinChatMessageResponse = UnpinChatMessageMutation

type Document = TypedDocumentNode<MutateUnpinChatMessageResponse, InputVariables<MutateUnpinChatMessageRequest>>

const mutation1: Document = gql`
    mutation UnpinChatMessage($input: ChatPinInput!) {
        unpinChatMessage(input: $input) {
            message {
                id
                roomId
                pinned
            }
            refusal
        }
    }
`

enum MutationUnpinChatMessage {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationUnpinChatMessage, Document> = { [MutationUnpinChatMessage.Mutation1]: mutation1 }

/** Parameters of the UnpinChatMessage mutation. */
type MutateUnpinChatMessageParams = MutateParams<MutationUnpinChatMessage, MutateUnpinChatMessageRequest>

/** Takes the pin off a message of a room. */
export const mutateUnpinChatMessage = async ({
    mutation = MutationUnpinChatMessage.Mutation1,
    request,
    signal,
    headers,
}: MutateUnpinChatMessageParams): Promise<ApolloClient.MutateResult<MutateUnpinChatMessageResponse>> => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
        context: { headers },
    })
}
