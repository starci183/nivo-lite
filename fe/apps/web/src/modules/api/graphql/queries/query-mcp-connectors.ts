import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { McpConnectorsQuery } from "../__generated__/graphql"

/** The response of the `mcpConnectors` query: the typed payload straight from the back end contract. */
type QueryMcpConnectorsResponse = McpConnectorsQuery

const query1: TypedDocumentNode<QueryMcpConnectorsResponse> = gql`
    query McpConnectors {
        mcpConnectors {
            key
            name
            kind
            status
            url
            credentialRef
            contractVersion
            timeoutMs
            approvedAt
            checkedAt
            tools {
                name
                scope
                description
                approved
            }
        }
    }
`

enum QueryMcpConnectors {
    Query1 = "query1",
}

const queryMap: Record<QueryMcpConnectors, TypedDocumentNode<QueryMcpConnectorsResponse>> = {
    [QueryMcpConnectors.Query1]: query1,
}

/** Apollo params for {@link queryMcpConnectors}. */
type QueryMcpConnectorsParams = QueryParams<QueryMcpConnectors>

/** The MCP gateway connectors of the workspace and their namespaced tools. Rejects with the back end failure. */
export const queryMcpConnectors = async ({
    query = QueryMcpConnectors.Query1,
    signal,
}: QueryMcpConnectorsParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
    })
}
