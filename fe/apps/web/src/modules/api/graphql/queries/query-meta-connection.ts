import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryMetaConnectionArgs } from "../__generated__/schema"

/** The variables of the `metaConnection` query. */
export type QueryMetaConnectionRequest = QueryMetaConnectionArgs["input"]

/** The response of the `metaConnection` query: the typed payload straight from the back end contract. */
type QueryMetaConnectionResponse = Pick<Query, "metaConnection">

const query1: TypedDocumentNode<QueryMetaConnectionResponse, InputVariables<QueryMetaConnectionRequest>> = gql`
    query MetaConnection($input: GetMetaConnectionInput!) {
        metaConnection(input: $input) {
            id
            name
            status
            configured
            pages {
                id
                name
                category
                igId
                igUsername
            }
            pageId
            pageName
            igId
            igUsername
            firstEvent {
                amount
                at
                content
            }
            agentIds
        }
    }
`

enum QueryMetaConnection {
    Query1 = "query1",
}

const queryMap: Record<
    QueryMetaConnection,
    TypedDocumentNode<QueryMetaConnectionResponse, InputVariables<QueryMetaConnectionRequest>>
> = {
    [QueryMetaConnection.Query1]: query1,
}

/** Apollo params for {@link queryMetaConnection}. */
interface QueryMetaConnectionParams extends QueryParams<QueryMetaConnection, QueryMetaConnectionRequest> {
    request: QueryMetaConnectionRequest
}

/** The Meta wizard view of a connection (resume). Rejects with the back end failure. */
export const queryMetaConnection = async ({
    query = QueryMetaConnection.Query1,
    request,
    signal,
}: QueryMetaConnectionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
