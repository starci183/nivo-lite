import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { PinChatMessageMutation, PinChatMessageMutationVariables } from "../__generated__/graphql"

/** Generated input of the PinChatMessage mutation. */
type MutatePinChatMessageRequest = WireInput<PinChatMessageMutationVariables["input"]>

type MutatePinChatMessageResponse = PinChatMessageMutation

type Document = TypedDocumentNode<MutatePinChatMessageResponse, InputVariables<MutatePinChatMessageRequest>>

const mutation1: Document = gql`
    mutation PinChatMessage($input: ChatPinInput!) {
        pinChatMessage(input: $input) {
            message {
                id
                roomId
                pinned
            }
            refusal
        }
    }
`

enum MutationPinChatMessage {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationPinChatMessage, Document> = { [MutationPinChatMessage.Mutation1]: mutation1 }

/** Parameters of the PinChatMessage mutation. */
type MutatePinChatMessageParams = MutateParams<MutationPinChatMessage, MutatePinChatMessageRequest>

/** Pins a message of a room. */
export const mutatePinChatMessage = async ({
    mutation = MutationPinChatMessage.Mutation1,
    request,
    signal,
    headers,
}: MutatePinChatMessageParams): Promise<ApolloClient.MutateResult<MutatePinChatMessageResponse>> => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
        context: { headers },
    })
}
