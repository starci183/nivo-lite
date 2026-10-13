import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryAgentChatConversationsArgs } from "../__generated__/schema"

/** Generated variables of the conversation history query. */
type QueryAgentChatConversationsRequest = QueryAgentChatConversationsArgs["input"]

/** Generated selection of the conversation history query. */
type QueryAgentChatConversationsResponse = Pick<Query, "agentChatConversations">

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

/** Parameters of the agent's conversation history query. */
type QueryAgentChatConversationsParams = QueryParams<
    QueryAgentChatConversations,
    QueryAgentChatConversationsRequest
> & { request: QueryAgentChatConversationsRequest }

/** Loads conversations under the active workspace's membership. */
export const queryAgentChatConversations = async ({ request, signal, headers }: QueryAgentChatConversationsParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.query({
        query: query1,
        variables: { input: request },
        context: { headers },
    })
}
