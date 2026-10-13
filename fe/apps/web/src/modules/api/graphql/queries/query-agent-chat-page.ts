import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryAgentChatPageArgs } from "../__generated__/schema"

/** Generated variables of the chat metadata query. */
type QueryAgentChatPageRequest = QueryAgentChatPageArgs["input"]

/** Generated selection of the chat metadata query. */
type QueryAgentChatPageResponse = Pick<Query, "agentChatPage">

type Document = TypedDocumentNode<QueryAgentChatPageResponse, InputVariables<QueryAgentChatPageRequest>>

const query1: Document = gql`
    query AgentChatPage($input: AgentChatPageInput!) {
        agentChatPage(input: $input) {
            id
            module
            name
            handle
            role
            isActive
            hasCustomerChannel
            workspaceId
            showWelcome
        }
    }
`

enum QueryAgentChatPage {
    Query1 = "query1",
}

/** Parameters of the agent chat page query. */
type QueryAgentChatPageParams = QueryParams<QueryAgentChatPage, QueryAgentChatPageRequest> & {
    request: QueryAgentChatPageRequest
}

/** Loads the selected agent's chat metadata and welcome eligibility. */
export const queryAgentChatPage = async ({ request, signal, headers }: QueryAgentChatPageParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.query({
        query: query1,
        variables: { input: request },
        context: { headers },
    })
}
