import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { MarkChatRoomReadMutation, MarkChatRoomReadMutationVariables } from "../__generated__/graphql"

/** Generated input of the MarkChatRoomRead mutation. */
type MutateMarkChatRoomReadRequest = WireInput<MarkChatRoomReadMutationVariables["input"]>

type MutateMarkChatRoomReadResponse = MarkChatRoomReadMutation

type Document = TypedDocumentNode<MutateMarkChatRoomReadResponse, InputVariables<MutateMarkChatRoomReadRequest>>

const mutation1: Document = gql`
    mutation MarkChatRoomRead($input: MarkChatRoomReadInput!) {
        markChatRoomRead(input: $input) {
            unread {
                roomId
                unreadCount
                mentionCount
            }
            refusal
        }
    }
`

enum MutationMarkChatRoomRead {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationMarkChatRoomRead, Document> = { [MutationMarkChatRoomRead.Mutation1]: mutation1 }

/** Parameters of the MarkChatRoomRead mutation. */
type MutateMarkChatRoomReadParams = MutateParams<MutationMarkChatRoomRead, MutateMarkChatRoomReadRequest>

/** Marks a room read up to its newest message. */
export const mutateMarkChatRoomRead = async ({
    mutation = MutationMarkChatRoomRead.Mutation1,
    request,
    signal,
    headers,
}: MutateMarkChatRoomReadParams): Promise<ApolloClient.MutateResult<MutateMarkChatRoomReadResponse>> => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
        context: { headers },
    })
}
