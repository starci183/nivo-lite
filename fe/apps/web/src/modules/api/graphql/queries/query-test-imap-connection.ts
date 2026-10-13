import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryTestImapConnectionArgs } from "../__generated__/schema"

/** The variables of the `testImapConnection` query. */
export type QueryTestImapConnectionRequest = QueryTestImapConnectionArgs["input"]

/** The response of the `testImapConnection` query: the typed payload straight from the back end contract. */
type QueryTestImapConnectionResponse = Pick<Query, "testImapConnection">

const query1: TypedDocumentNode<QueryTestImapConnectionResponse, InputVariables<QueryTestImapConnectionRequest>> = gql`
    query TestImapConnection($input: TestImapConnectionInput!) {
        testImapConnection(input: $input) {
            folders
        }
    }
`

enum QueryTestImapConnection {
    Query1 = "query1",
}

const queryMap: Record<
    QueryTestImapConnection,
    TypedDocumentNode<QueryTestImapConnectionResponse, InputVariables<QueryTestImapConnectionRequest>>
> = {
    [QueryTestImapConnection.Query1]: query1,
}

/** Apollo params for {@link queryTestImapConnection}. */
interface QueryTestImapConnectionParams extends QueryParams<QueryTestImapConnection, QueryTestImapConnectionRequest> {
    request: QueryTestImapConnectionRequest
}

/** Logs in to a mailbox read only and lists its folders; nothing is saved. Rejects with the back end failure. */
export const queryTestImapConnection = async ({
    query = QueryTestImapConnection.Query1,
    request,
    signal,
}: QueryTestImapConnectionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
        fetchPolicy: "no-cache",
    })
}
