import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { ChatUnreadQuery } from "../__generated__/graphql"

type QueryChatUnreadResponse = ChatUnreadQuery

const query1: TypedDocumentNode<QueryChatUnreadResponse, Record<string, never>> = gql`
    query ChatUnread {
        chatUnread {
            total
            mentionTotal
            rooms {
                roomId
                unreadCount
                mentionCount
            }
        }
    }
`

enum QueryChatUnread {
    Query1 = "query1",
}

const queryMap: Record<QueryChatUnread, TypedDocumentNode<QueryChatUnreadResponse, Record<string, never>>> = {
    [QueryChatUnread.Query1]: query1,
}

/** The unread and mention counts of the viewer, per room that has some. */
export const queryChatUnread = async ({
    query = QueryChatUnread.Query1,
    signal,
    headers,
}: QueryParams<QueryChatUnread> = {}): Promise<ApolloClient.QueryResult<QueryChatUnreadResponse>> => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.query({ query: queryMap[query], context: { headers } })
}
