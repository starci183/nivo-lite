import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

/** The response of the `connectionAgents` query: the typed payload straight from the back end contract. */
type QueryConnectionAgentsResponse = Pick<Query, "connectionAgents">

const query1: TypedDocumentNode<QueryConnectionAgentsResponse> = gql`
    query ConnectionAgents {
        connectionAgents {
            id
            name
            module
            status
        }
    }
`

enum QueryConnectionAgents {
    Query1 = "query1",
}

const queryMap: Record<QueryConnectionAgents, TypedDocumentNode<QueryConnectionAgentsResponse>> = {
    [QueryConnectionAgents.Query1]: query1,
}

/** Apollo params for {@link queryConnectionAgents}. */
type QueryConnectionAgentsParams = QueryParams<QueryConnectionAgents>

/** The agents of the workspace the connections console names. Rejects with the back end failure. */
export const queryConnectionAgents = async ({
    query = QueryConnectionAgents.Query1,
    signal,
}: QueryConnectionAgentsParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
    })
}
