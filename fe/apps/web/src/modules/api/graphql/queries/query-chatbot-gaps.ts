import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

/** The response of the `chatbotGaps` query. */
type QueryChatbotGapsResponse = Pick<Query, "chatbotGaps">

type Document = TypedDocumentNode<QueryChatbotGapsResponse>

const query1: Document = gql`
    query ChatbotGaps {
        chatbotGaps {
            gaps {
                id
                attributeGuess
                count
                exampleConversationId
                firstSeenAt
                lastSeenAt
                module
                question
                reopenedCount
                status
                topic
            }
            lenses {
                audience
                module
                name
            }
        }
    }
`

enum QueryChatbotGaps {
    Query1 = "query1",
}

const queryMap: Record<QueryChatbotGaps, Document> = {
    [QueryChatbotGaps.Query1]: query1,
}

/** Apollo params for {@link queryChatbotGaps}. */
type QueryChatbotGapsParams = QueryParams<QueryChatbotGaps>

/** Reads the back end `chatbotGaps` query with the caller's workspace context. */
export const queryChatbotGaps = async ({ query = QueryChatbotGaps.Query1, signal }: QueryChatbotGapsParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
    })
}
