import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { ChatbotOverviewQuery, ChatbotOverviewQueryVariables } from "../__generated__/graphql"

/** The input of the `chatbotOverview` query. */
type QueryChatbotOverviewRequest = WireInput<ChatbotOverviewQueryVariables["input"]>

/** The response of the `chatbotOverview` query. */
type QueryChatbotOverviewResponse = ChatbotOverviewQuery

type Document = TypedDocumentNode<QueryChatbotOverviewResponse, InputVariables<QueryChatbotOverviewRequest>>

const query1: Document = gql`
    query ChatbotOverview($input: ChatbotOverviewInput!) {
        chatbotOverview(input: $input) {
            conversations {
                id
                channel
                name
                leadId
                lastText
                lastRole
                lastAt
                messageCount
                handledBy
                waiting
                unanswered
            }
            metrics {
                leadsCaptured7d
                p50FirstResponseMin
                sample
                today
                waiting
            }
            nowIso
            workspaceId
        }
    }
`

enum QueryChatbotOverview {
    Query1 = "query1",
}

const queryMap: Record<QueryChatbotOverview, Document> = {
    [QueryChatbotOverview.Query1]: query1,
}

/** Apollo params for {@link queryChatbotOverview}. */
type QueryChatbotOverviewParams = QueryParams<QueryChatbotOverview, QueryChatbotOverviewRequest>

/** Reads the back end `chatbotOverview` query with the caller's workspace context. */
export const queryChatbotOverview = async ({
    query = QueryChatbotOverview.Query1,
    request = {},
    signal,
}: QueryChatbotOverviewParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
        variables: { input: request },
    })
}
