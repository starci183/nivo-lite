import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { ConnectionAgentGrantsQuery } from "../__generated__/graphql"

/** The response of the `connectionAgentGrants` query: the typed payload straight from the back end contract. */
type QueryConnectionAgentGrantsResponse = ConnectionAgentGrantsQuery

const query1: TypedDocumentNode<QueryConnectionAgentGrantsResponse> = gql`
    query ConnectionAgentGrants {
        connectionAgentGrants {
            access
            agentId
            agentName
            connectionId
            module
            purpose
        }
    }
`

enum QueryConnectionAgentGrants {
    Query1 = "query1",
}

const queryMap: Record<QueryConnectionAgentGrants, TypedDocumentNode<QueryConnectionAgentGrantsResponse>> = {
    [QueryConnectionAgentGrants.Query1]: query1,
}

/** Apollo params for {@link queryConnectionAgentGrants}. */
type QueryConnectionAgentGrantsParams = QueryParams<QueryConnectionAgentGrants>

/** Every grant of the workspace beside its agent: which agent uses which connection, for what, at which level. */
export const queryConnectionAgentGrants = async ({
    query = QueryConnectionAgentGrants.Query1,
    signal,
}: QueryConnectionAgentGrantsParams = {}): Promise<ApolloClient.QueryResult<QueryConnectionAgentGrantsResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
    })
}
