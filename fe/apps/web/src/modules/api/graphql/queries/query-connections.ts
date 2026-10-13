import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

type QueryConnectionsResponse = Pick<Query, "connections">

const query1: TypedDocumentNode<QueryConnectionsResponse, Record<string, never>> = gql`
    query Connections {
        connections {
            id
            name
            provider
            status
            agentIds
        }
    }
`

enum QueryConnections {
    Query1 = "query1",
}

const queryMap: Record<QueryConnections, TypedDocumentNode<QueryConnectionsResponse, Record<string, never>>> = {
    [QueryConnections.Query1]: query1,
}

type QueryConnectionsParams = QueryParams<QueryConnections>

/** The back end `connections` query. Rejects with the back end failure (message localized by the server). */
export const queryConnections = async ({ query = QueryConnections.Query1, signal }: QueryConnectionsParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
