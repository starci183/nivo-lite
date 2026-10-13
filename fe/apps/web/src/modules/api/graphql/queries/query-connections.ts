import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

/** The response of the `connections` query: the typed payload straight from the back end contract. */
type QueryConnectionsResponse = Pick<Query, "connections">

const query1: TypedDocumentNode<QueryConnectionsResponse> = gql`
    query Connections {
        connections {
            id
            workspaceId
            provider
            name
            meta
            status
            lastError
            environment
            isDefault
            lastEventAt
            firstEvent {
                amount
                at
                content
            }
            agentIds
            grants {
                agentId
                access
            }
        }
    }
`

enum QueryConnections {
    Query1 = "query1",
}

const queryMap: Record<QueryConnections, TypedDocumentNode<QueryConnectionsResponse>> = {
    [QueryConnections.Query1]: query1,
}

/** Apollo params for {@link queryConnections}. */
type QueryConnectionsParams = QueryParams<QueryConnections>

/** The connections of the workspace with the agents bound to each. Rejects with the back end failure. */
export const queryConnections = async ({ query = QueryConnections.Query1, signal }: QueryConnectionsParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
    })
}
