import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryDataSyncRunArgs } from "../__generated__/schema"

/** The variables of the `dataSyncRun` query. */
type QueryDataSyncRunRequest = QueryDataSyncRunArgs["input"]

/** The response of the `dataSyncRun` query. */
type QueryDataSyncRunResponse = Pick<Query, "dataSyncRun">

const query1: TypedDocumentNode<QueryDataSyncRunResponse, InputVariables<QueryDataSyncRunRequest>> = gql`
    query DataSyncRun($input: DataSyncRunInput!) {
        dataSyncRun(input: $input) {
            id
            connectionId
            trigger
            state
            rows
            error
            startedAt
            finishedAt
        }
    }
`

enum QueryDataSyncRun {
    Query1 = "query1",
}

const queryMap: Record<
    QueryDataSyncRun,
    TypedDocumentNode<QueryDataSyncRunResponse, InputVariables<QueryDataSyncRunRequest>>
> = {
    [QueryDataSyncRun.Query1]: query1,
}

/** Apollo params for {@link queryDataSyncRun}. */
interface QueryDataSyncRunParams extends QueryParams<QueryDataSyncRun, QueryDataSyncRunRequest> {
    request: QueryDataSyncRunRequest
}

/** How one sync run of a data connection is going. Rejects with the back end failure. */
export const queryDataSyncRun = async ({ query = QueryDataSyncRun.Query1, request, signal }: QueryDataSyncRunParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
