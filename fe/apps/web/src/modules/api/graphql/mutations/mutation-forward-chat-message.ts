import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { ForwardChatMessageMutation, ForwardChatMessageMutationVariables } from "../__generated__/graphql"

/** Generated input of the ForwardChatMessage mutation. */
type MutateForwardChatMessageRequest = WireInput<ForwardChatMessageMutationVariables["input"]>

type MutateForwardChatMessageResponse = ForwardChatMessageMutation

type Document = TypedDocumentNode<MutateForwardChatMessageResponse, InputVariables<MutateForwardChatMessageRequest>>

const mutation1: Document = gql`
    mutation ForwardChatMessage($input: ChatForwardInput!) {
        forwardChatMessage(input: $input) {
            message {
                id
                roomId
            }
            refusal
        }
    }
`

enum MutationForwardChatMessage {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationForwardChatMessage, Document> = { [MutationForwardChatMessage.Mutation1]: mutation1 }

/** Parameters of the ForwardChatMessage mutation. */
type MutateForwardChatMessageParams = MutateParams<MutationForwardChatMessage, MutateForwardChatMessageRequest>

/** Forwards a message into another room the caller sits in. */
export const mutateForwardChatMessage = async ({
    mutation = MutationForwardChatMessage.Mutation1,
    request,
    signal,
    headers,
}: MutateForwardChatMessageParams): Promise<ApolloClient.MutateResult<MutateForwardChatMessageResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
        context: { headers },
    })
}
