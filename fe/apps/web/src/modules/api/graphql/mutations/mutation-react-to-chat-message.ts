import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { ReactToChatMessageMutation, ReactToChatMessageMutationVariables } from "../__generated__/graphql"

/** Generated input of the ReactToChatMessage mutation. */
type MutateReactToChatMessageRequest = WireInput<ReactToChatMessageMutationVariables["input"]>

type MutateReactToChatMessageResponse = ReactToChatMessageMutation

type Document = TypedDocumentNode<MutateReactToChatMessageResponse, InputVariables<MutateReactToChatMessageRequest>>

const mutation1: Document = gql`
    mutation ReactToChatMessage($input: ChatReactInput!) {
        reactToChatMessage(input: $input) {
            message {
                id
                roomId
                reactions {
                    emoji
                    count
                    mine
                    mineCount
                }
            }
            refusal
        }
    }
`

enum MutationReactToChatMessage {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationReactToChatMessage, Document> = { [MutationReactToChatMessage.Mutation1]: mutation1 }

/** Parameters of the ReactToChatMessage mutation. */
type MutateReactToChatMessageParams = MutateParams<MutationReactToChatMessage, MutateReactToChatMessageRequest>

/** Adds taps of one emoji to a message; a burst of taps is one call with `times`. */
export const mutateReactToChatMessage = async ({
    mutation = MutationReactToChatMessage.Mutation1,
    request,
    signal,
    headers,
}: MutateReactToChatMessageParams): Promise<ApolloClient.MutateResult<MutateReactToChatMessageResponse>> => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
        context: { headers },
    })
}
