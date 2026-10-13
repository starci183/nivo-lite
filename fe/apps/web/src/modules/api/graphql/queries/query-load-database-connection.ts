import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { LoadDatabaseConnectionQuery, LoadDatabaseConnectionQueryVariables } from "../__generated__/graphql"

/** The variables of the `loadDatabaseConnection` query. */
type QueryLoadDatabaseConnectionRequest = WireInput<LoadDatabaseConnectionQueryVariables["input"]>

/** The response of the `loadDatabaseConnection` query. */
type QueryLoadDatabaseConnectionResponse = LoadDatabaseConnectionQuery

const query1: TypedDocumentNode<
    QueryLoadDatabaseConnectionResponse,
    InputVariables<QueryLoadDatabaseConnectionRequest>
> = gql`
    query LoadDatabaseConnection($input: LoadDatabaseConnectionInput!) {
        loadDatabaseConnection(input: $input) {
            name
            target {
                engine
                host
                port
                database
                user
                ssl
            }
            hasPassword
            tables
            everyMinutes
            agentIds
        }
    }
`

enum QueryLoadDatabaseConnection {
    Query1 = "query1",
}

const queryMap: Record<
    QueryLoadDatabaseConnection,
    TypedDocumentNode<QueryLoadDatabaseConnectionResponse, InputVariables<QueryLoadDatabaseConnectionRequest>>
> = {
    [QueryLoadDatabaseConnection.Query1]: query1,
}

/** Apollo params for {@link queryLoadDatabaseConnection}. */
interface QueryLoadDatabaseConnectionParams extends QueryParams<
    QueryLoadDatabaseConnection,
    QueryLoadDatabaseConnectionRequest
> {
    request: QueryLoadDatabaseConnectionRequest
}

/** Reopens a saved database connection for editing (never the password). Rejects with the back end failure. */
export const queryLoadDatabaseConnection = async ({
    query = QueryLoadDatabaseConnection.Query1,
    request,
    signal,
}: QueryLoadDatabaseConnectionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
