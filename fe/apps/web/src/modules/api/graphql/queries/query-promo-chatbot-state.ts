import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

/** The generated workspace chatbot promo query response. */
type QueryPromoChatbotStateResponse = Pick<Query, "promoChatbotState">

type Document = TypedDocumentNode<QueryPromoChatbotStateResponse>

const query1: Document = gql`
    query PromoChatbotState {
        promoChatbotState {
            hasChatbot
            agentId
            handle
            name
        }
    }
`

enum QueryPromoChatbotState {
    Query1 = "query1",
}

const queryMap: Record<QueryPromoChatbotState, Document> = { [QueryPromoChatbotState.Query1]: query1 }

/** Reads whether the workspace already owns a chatbot. */
export const queryPromoChatbotState = async ({
    query = QueryPromoChatbotState.Query1,
    signal,
}: QueryParams<QueryPromoChatbotState> = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
