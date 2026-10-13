import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryLoadOpenApiConnectionArgs } from "../__generated__/schema"

/** The variables of the `loadOpenApiConnection` query. */
type QueryLoadOpenApiConnectionRequest = QueryLoadOpenApiConnectionArgs["input"]

/** The response of the `loadOpenApiConnection` query. */
type QueryLoadOpenApiConnectionResponse = Pick<Query, "loadOpenApiConnection">

const query1: TypedDocumentNode<QueryLoadOpenApiConnectionResponse, InputVariables<QueryLoadOpenApiConnectionRequest>> = gql`
    query LoadOpenApiConnection($input: LoadOpenApiConnectionInput!) {
        loadOpenApiConnection(input: $input) {
            name
            config
            syncEveryMinutes
            hasSecret
            authUser
        }
    }
`

enum QueryLoadOpenApiConnectionKind {
    Query1 = "query1",
}

const queryMap: Record<QueryLoadOpenApiConnectionKind, TypedDocumentNode<QueryLoadOpenApiConnectionResponse, InputVariables<QueryLoadOpenApiConnectionRequest>>> = {
    [QueryLoadOpenApiConnectionKind.Query1]: query1,
}

/** Apollo params for {@link queryLoadOpenApiConnection}. */
interface QueryLoadOpenApiConnectionParams extends QueryParams<QueryLoadOpenApiConnectionKind, QueryLoadOpenApiConnectionRequest> {
    request: QueryLoadOpenApiConnectionRequest
}

/** Reads a saved API connection for the wizard (never a secret). Rejects with the back end failure. */
export const queryLoadOpenApiConnection = async ({ query = QueryLoadOpenApiConnectionKind.Query1, request, signal }: QueryLoadOpenApiConnectionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
