import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { LoadOpenApiConnectionQuery, LoadOpenApiConnectionQueryVariables } from "../__generated__/graphql"

/** The variables of the `loadOpenApiConnection` query. */
type QueryLoadOpenApiConnectionRequest = WireInput<LoadOpenApiConnectionQueryVariables["input"]>

/** The response of the `loadOpenApiConnection` query. */
type QueryLoadOpenApiConnectionResponse = LoadOpenApiConnectionQuery

const query1: TypedDocumentNode<
    QueryLoadOpenApiConnectionResponse,
    InputVariables<QueryLoadOpenApiConnectionRequest>
> = gql`
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

const queryMap: Record<
    QueryLoadOpenApiConnectionKind,
    TypedDocumentNode<QueryLoadOpenApiConnectionResponse, InputVariables<QueryLoadOpenApiConnectionRequest>>
> = {
    [QueryLoadOpenApiConnectionKind.Query1]: query1,
}

/** Apollo params for {@link queryLoadOpenApiConnection}. */
interface QueryLoadOpenApiConnectionParams extends QueryParams<
    QueryLoadOpenApiConnectionKind,
    QueryLoadOpenApiConnectionRequest
> {
    request: QueryLoadOpenApiConnectionRequest
}

/** Reads a saved API connection for the wizard (never a secret). Rejects with the back end failure. */
export const queryLoadOpenApiConnection = async ({
    query = QueryLoadOpenApiConnectionKind.Query1,
    request,
    signal,
}: QueryLoadOpenApiConnectionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
