import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { ChatRoomsQuery, ChatRoomsQueryVariables } from "../__generated__/graphql"

/** Generated variables of the ChatRooms query. */
type QueryChatRoomsRequest = WireInput<ChatRoomsQueryVariables["input"]>

type QueryChatRoomsResponse = ChatRoomsQuery

type Document = TypedDocumentNode<QueryChatRoomsResponse, InputVariables<QueryChatRoomsRequest>>

const query1: Document = gql`
    query ChatRooms($input: ChatRoomsInput) {
        chatRooms(input: $input) {
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
    }
`

enum QueryChatRooms {
    Query1 = "query1",
}

const queryMap: Record<QueryChatRooms, Document> = { [QueryChatRooms.Query1]: query1 }

/** Parameters of the ChatRooms query. */
type QueryChatRoomsParams = QueryParams<QueryChatRooms, QueryChatRoomsRequest> & { request: QueryChatRoomsRequest }

/** The rooms the viewer is a member of, newest message first; with kind direct and a member, the direct room with that member, or none. */
export const queryChatRooms = async ({
    query = QueryChatRooms.Query1,
    request,
    signal,
    headers,
}: QueryChatRoomsParams): Promise<ApolloClient.QueryResult<QueryChatRoomsResponse>> => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
        context: { headers },
    })
}
