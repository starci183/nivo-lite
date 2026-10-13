import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryAgentConnectionsArgs } from "../__generated__/schema"

/** The input of the `agentConnections` query. */
export type QueryAgentConnectionsRequest = QueryAgentConnectionsArgs["input"]

type QueryAgentConnectionsResponse = Pick<Query, "agentConnections">

const query1: TypedDocumentNode<QueryAgentConnectionsResponse, InputVariables<QueryAgentConnectionsRequest>> = gql`
    query AgentConnections($input: AgentIdInput!) {
        agentConnections(input: $input) {
            access
            id
            name
            provider
            purpose
            status
        }
    }
`

enum QueryAgentConnections {
    Query1 = "query1",
}

const queryMap: Record<
    QueryAgentConnections,
    TypedDocumentNode<QueryAgentConnectionsResponse, InputVariables<QueryAgentConnectionsRequest>>
> = {
    [QueryAgentConnections.Query1]: query1,
}

type QueryAgentConnectionsParams = QueryParams<QueryAgentConnections, QueryAgentConnectionsRequest> & {
    request: QueryAgentConnectionsRequest
}

/** The back end `agentConnections` query. Rejects with the back end failure (message localized by the server). */
export const queryAgentConnections = async ({
    query = QueryAgentConnections.Query1,
    request,
    signal,
}: QueryAgentConnectionsParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
