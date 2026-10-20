import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { McpToolGrantsQuery } from "../__generated__/graphql"

/** The response of the `mcpToolGrants` query: the typed payload straight from the back end contract. */
type QueryMcpToolGrantsResponse = McpToolGrantsQuery

const query1: TypedDocumentNode<QueryMcpToolGrantsResponse> = gql`
    query McpToolGrants {
        mcpToolGrants {
            agentId
            agentName
            tool
            mode
            limitVnd
            constraintsJson
        }
    }
`

enum QueryMcpToolGrants {
    Query1 = "query1",
}

const queryMap: Record<QueryMcpToolGrants, TypedDocumentNode<QueryMcpToolGrantsResponse>> = {
    [QueryMcpToolGrants.Query1]: query1,
}

/** Apollo params for {@link queryMcpToolGrants}. */
type QueryMcpToolGrantsParams = QueryParams<QueryMcpToolGrants>

/** Every agent's grants of gateway tools (default deny). Rejects with the back end failure. */
export const queryMcpToolGrants = async ({
    query = QueryMcpToolGrants.Query1,
    signal,
}: QueryMcpToolGrantsParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
    })
}
