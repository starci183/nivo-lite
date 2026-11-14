import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { DataSyncRunQuery, DataSyncRunQueryVariables } from "../__generated__/graphql"

/** The variables of the `dataSyncRun` query. */
type QueryDataSyncRunRequest = WireInput<DataSyncRunQueryVariables["input"]>

/** The response of the `dataSyncRun` query. */
type QueryDataSyncRunResponse = DataSyncRunQuery

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
export const queryDataSyncRun = async ({
    query = QueryDataSyncRun.Query1,
    request,
    signal,
}: QueryDataSyncRunParams): Promise<ApolloClient.QueryResult<QueryDataSyncRunResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
