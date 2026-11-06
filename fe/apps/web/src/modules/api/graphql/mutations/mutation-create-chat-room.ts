import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { CreateChatRoomMutation, CreateChatRoomMutationVariables } from "../__generated__/graphql"

/** Generated input of the CreateChatRoom mutation. */
type MutateCreateChatRoomRequest = WireInput<CreateChatRoomMutationVariables["input"]>

type MutateCreateChatRoomResponse = CreateChatRoomMutation

type Document = TypedDocumentNode<MutateCreateChatRoomResponse, InputVariables<MutateCreateChatRoomRequest>>

const mutation1: Document = gql`
    mutation CreateChatRoom($input: CreateChatRoomInput!) {
        createChatRoom(input: $input) {
            room {
                id
                kind
                name
                position
                createdBy
                createdAt
                members {
                    memberKind
                    memberId
                    name
                    role
                    lastReadAt
                    muted
                }
                unreadCount
                mentionCount
                muted
                lastMessage {
                    id
                    kind
                    authorKind
                    authorName
                    body
                    createdAt
                }
            }
            refusal
        }
    }
`

enum MutationCreateChatRoom {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationCreateChatRoom, Document> = { [MutationCreateChatRoom.Mutation1]: mutation1 }

/** Parameters of the CreateChatRoom mutation. */
type MutateCreateChatRoomParams = MutateParams<MutationCreateChatRoom, MutateCreateChatRoomRequest>

/** Opens a direct room (idempotent per pair) or a group room. */
export const mutateCreateChatRoom = async ({
    mutation = MutationCreateChatRoom.Mutation1,
    request,
    signal,
    headers,
}: MutateCreateChatRoomParams): Promise<ApolloClient.MutateResult<MutateCreateChatRoomResponse>> => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
        context: { headers },
    })
}
