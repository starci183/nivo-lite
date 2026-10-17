import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { AgentChatMessagesQuery, AgentChatMessagesQueryVariables } from "../__generated__/graphql"

/** Generated variables of the conversation thread query. */
type QueryAgentChatMessagesRequest = WireInput<AgentChatMessagesQueryVariables["input"]>

/** Generated selection of the conversation thread query. */
type QueryAgentChatMessagesResponse = AgentChatMessagesQuery

type Document = TypedDocumentNode<QueryAgentChatMessagesResponse, InputVariables<QueryAgentChatMessagesRequest>>

const query1: Document = gql`
    query AgentChatMessages($input: AgentChatMessagesInput!) {
        agentChatMessages(input: $input) {
            id
            role
            body
            createdAt
        }
    }
`

enum QueryAgentChatMessages {
    Query1 = "query1",
}

const queryMap: Record<QueryAgentChatMessages, Document> = { [QueryAgentChatMessages.Query1]: query1 }

/** Parameters of the conversation's message query. */
type QueryAgentChatMessagesParams = QueryParams<QueryAgentChatMessages, QueryAgentChatMessagesRequest> & {
    request: QueryAgentChatMessagesRequest
}

/** Loads the conversation thread through the back end. */
export const queryAgentChatMessages = async ({
    query = QueryAgentChatMessages.Query1,
    request,
    signal,
    headers,
}: QueryAgentChatMessagesParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
        context: { headers },
    })
}
