import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { SendChatMessageMutation, SendChatMessageMutationVariables } from "../__generated__/graphql"

/** Generated input of the SendChatMessage mutation. */
type MutateSendChatMessageRequest = WireInput<SendChatMessageMutationVariables["input"]>

type MutateSendChatMessageResponse = SendChatMessageMutation

type Document = TypedDocumentNode<MutateSendChatMessageResponse, InputVariables<MutateSendChatMessageRequest>>

const mutation1: Document = gql`
    mutation SendChatMessage($input: SendChatMessageInput!) {
        sendChatMessage(input: $input) {
            message {
                id
                roomId
                kind
                authorKind
                authorId
                authorName
                body
                createdAt
                editedAt
                pinned
                mentions {
                    memberKind
                    memberId
                    name
                }
                attachments {
                    fileKey
                    name
                    mimeType
                    sizeBytes
                    url
                }
                report {
                    runId
                    agentId
                }
                approval {
                    decisionId
                    status
                    decidedByName
                    decidedAt
                    canDecide
                }
            }
            refusal
        }
    }
`

enum MutationSendChatMessage {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSendChatMessage, Document> = { [MutationSendChatMessage.Mutation1]: mutation1 }

/** Parameters of the SendChatMessage mutation. */
type MutateSendChatMessageParams = MutateParams<MutationSendChatMessage, MutateSendChatMessageRequest>

/** Sends a text message to a room, or to a member: the first send opens the direct room. */
export const mutateSendChatMessage = async ({
    mutation = MutationSendChatMessage.Mutation1,
    request,
    signal,
    headers,
}: MutateSendChatMessageParams): Promise<ApolloClient.MutateResult<MutateSendChatMessageResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
        context: { headers },
    })
}
