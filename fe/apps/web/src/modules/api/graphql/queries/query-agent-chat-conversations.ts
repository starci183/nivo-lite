import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { AgentChatConversationsQuery, AgentChatConversationsQueryVariables } from "../__generated__/graphql"

/** Generated variables of the conversation history query. */
type QueryAgentChatConversationsRequest = WireInput<AgentChatConversationsQueryVariables["input"]>

/** Generated selection of the conversation history query. */
type QueryAgentChatConversationsResponse = AgentChatConversationsQuery

type Document = TypedDocumentNode<
    QueryAgentChatConversationsResponse,
    InputVariables<QueryAgentChatConversationsRequest>
>

const query1: Document = gql`
    query AgentChatConversations($input: AgentChatConversationsInput!) {
        agentChatConversations(input: $input) {
            id
            kind
            channel
            visitorName
            leadId
            handledBy
            createdAt
        }
    }
`

enum QueryAgentChatConversations {
    Query1 = "query1",
}

const queryMap: Record<QueryAgentChatConversations, Document> = { [QueryAgentChatConversations.Query1]: query1 }

/** Parameters of the agent's conversation history query. */
type QueryAgentChatConversationsParams = QueryParams<
    QueryAgentChatConversations,
    QueryAgentChatConversationsRequest
> & { request: QueryAgentChatConversationsRequest }

/** Loads conversations under the active workspace's membership. */
export const queryAgentChatConversations = async ({
    query = QueryAgentChatConversations.Query1,
    request,
    signal,
    headers,
}: QueryAgentChatConversationsParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
        context: { headers },
    })
}
