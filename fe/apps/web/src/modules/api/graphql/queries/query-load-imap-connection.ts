import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryLoadImapConnectionArgs } from "../__generated__/schema"

/** The variables of the `loadImapConnection` query. */
type QueryLoadImapConnectionRequest = QueryLoadImapConnectionArgs["input"]

/** The response of the `loadImapConnection` query: the typed payload straight from the back end contract. */
type QueryLoadImapConnectionResponse = Pick<Query, "loadImapConnection">

const query1: TypedDocumentNode<QueryLoadImapConnectionResponse, InputVariables<QueryLoadImapConnectionRequest>> = gql`
    query LoadImapConnection($input: LoadImapConnectionInput!) {
        loadImapConnection(input: $input) {
            id
            name
            email
            host
            port
            security
            user
            folders
            sinceDays
            syncEveryMinutes
            agentIds
        }
    }
`

enum QueryLoadImapConnection {
    Query1 = "query1",
}

const queryMap: Record<
    QueryLoadImapConnection,
    TypedDocumentNode<QueryLoadImapConnectionResponse, InputVariables<QueryLoadImapConnectionRequest>>
> = {
    [QueryLoadImapConnection.Query1]: query1,
}

/** Apollo params for {@link queryLoadImapConnection}. */
interface QueryLoadImapConnectionParams extends QueryParams<QueryLoadImapConnection, QueryLoadImapConnectionRequest> {
    request: QueryLoadImapConnectionRequest
}

/** The saved mailbox for editing, without its password. Rejects with the back end failure. */
export const queryLoadImapConnection = async ({
    query = QueryLoadImapConnection.Query1,
    request,
    signal,
}: QueryLoadImapConnectionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
