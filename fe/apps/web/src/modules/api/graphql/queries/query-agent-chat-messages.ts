import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryAgentChatMessagesArgs } from "../__generated__/schema"

/** Generated variables of the conversation thread query. */
type QueryAgentChatMessagesRequest = QueryAgentChatMessagesArgs["input"]

/** Generated selection of the conversation thread query. */
type QueryAgentChatMessagesResponse = Pick<Query, "agentChatMessages">

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

/** Parameters of the conversation's message query. */
type QueryAgentChatMessagesParams = QueryParams<QueryAgentChatMessages, QueryAgentChatMessagesRequest> & {
    request: QueryAgentChatMessagesRequest
}

/** Loads the conversation thread through the back end. */
export const queryAgentChatMessages = async ({ request, signal, headers }: QueryAgentChatMessagesParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.query({
        query: query1,
        variables: { input: request },
        context: { headers },
    })
}
