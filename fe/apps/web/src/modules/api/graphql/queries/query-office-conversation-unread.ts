import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { OfficeConversationUnreadQuery } from "../__generated__/graphql"

type QueryOfficeConversationUnreadResponse = OfficeConversationUnreadQuery

const query1: TypedDocumentNode<QueryOfficeConversationUnreadResponse, Record<string, never>> = gql`
    query OfficeConversationUnread {
        officeConversationUnread {
            agents {
                id
                unread
            }
            leads {
                id
                unread
            }
        }
    }
`

enum QueryOfficeConversationUnread {
    Query1 = "query1",
}

const queryMap: Record<
    QueryOfficeConversationUnread,
    TypedDocumentNode<QueryOfficeConversationUnreadResponse, Record<string, never>>
> = {
    [QueryOfficeConversationUnread.Query1]: query1,
}

/** The back end `officeConversationUnread` query: the caller's unread counts of the agent and customer conversations. */
export const queryOfficeConversationUnread = async ({
    query = QueryOfficeConversationUnread.Query1,
    signal,
}: QueryParams<QueryOfficeConversationUnread> = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
