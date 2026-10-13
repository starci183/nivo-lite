import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { ZaloConnectionQuery, ZaloConnectionQueryVariables } from "../__generated__/graphql"

/** The variables of the `zaloConnection` query. */
type QueryZaloConnectionRequest = WireInput<ZaloConnectionQueryVariables["input"]>

/** The response of the `zaloConnection` query: the typed payload straight from the back end contract. */
type QueryZaloConnectionResponse = ZaloConnectionQuery

const query1: TypedDocumentNode<QueryZaloConnectionResponse, InputVariables<QueryZaloConnectionRequest>> = gql`
    query ZaloConnection($input: GetZaloConnectionInput!) {
        zaloConnection(input: $input) {
            id
            name
            status
            webhookUrl
            callbackUrl
            authorized
            oaSecretSaved
            oaId
            firstEvent {
                amount
                at
                content
            }
            agentIds
        }
    }
`

enum QueryZaloConnection {
    Query1 = "query1",
}

const queryMap: Record<
    QueryZaloConnection,
    TypedDocumentNode<QueryZaloConnectionResponse, InputVariables<QueryZaloConnectionRequest>>
> = {
    [QueryZaloConnection.Query1]: query1,
}

/** Apollo params for {@link queryZaloConnection}. */
interface QueryZaloConnectionParams extends QueryParams<QueryZaloConnection, QueryZaloConnectionRequest> {
    request: QueryZaloConnectionRequest
}

/** The Zalo wizard view of a connection (resume). Rejects with the back end failure. */
export const queryZaloConnection = async ({
    query = QueryZaloConnection.Query1,
    request,
    signal,
}: QueryZaloConnectionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
