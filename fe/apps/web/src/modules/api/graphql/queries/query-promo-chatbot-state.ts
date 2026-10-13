import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

/** Generated response of the promoChatbotState query. */
type QueryPromoChatbotStateResponse = Pick<Query, "promoChatbotState">

type Document = TypedDocumentNode<QueryPromoChatbotStateResponse>

const query1: Document = gql`
    query PromoChatbotState {
        promoChatbotState {
            agentId
            handle
            hasChatbot
            name
        }
    }
`

enum QueryPromoChatbotState {
    Query1 = "query1",
}

const queryMap: Record<QueryPromoChatbotState, Document> = {
    [QueryPromoChatbotState.Query1]: query1,
}

/** Apollo parameters for the promoChatbotState query. */
type QueryPromoChatbotStateParams = QueryParams<QueryPromoChatbotState>

/** Runs the workspace-scoped promoChatbotState query through the authenticated GraphQL client. */
export const queryPromoChatbotState = async ({
    query = QueryPromoChatbotState.Query1,
    signal,
    headers,
}: QueryPromoChatbotStateParams = {}) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
    })
}
