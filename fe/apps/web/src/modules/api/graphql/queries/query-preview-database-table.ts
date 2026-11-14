import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { PreviewDatabaseTableQuery, PreviewDatabaseTableQueryVariables } from "../__generated__/graphql"

/** The variables of the `previewDatabaseTable` query. */
type QueryPreviewDatabaseTableRequest = WireInput<PreviewDatabaseTableQueryVariables["input"]>

/** The response of the `previewDatabaseTable` query. */
type QueryPreviewDatabaseTableResponse = PreviewDatabaseTableQuery

const query1: TypedDocumentNode<
    QueryPreviewDatabaseTableResponse,
    InputVariables<QueryPreviewDatabaseTableRequest>
> = gql`
    query PreviewDatabaseTable($input: PreviewDatabaseTableInput!) {
        previewDatabaseTable(input: $input) {
            columns
            rows {
                cells
            }
        }
    }
`

enum QueryPreviewDatabaseTable {
    Query1 = "query1",
}

const queryMap: Record<
    QueryPreviewDatabaseTable,
    TypedDocumentNode<QueryPreviewDatabaseTableResponse, InputVariables<QueryPreviewDatabaseTableRequest>>
> = {
    [QueryPreviewDatabaseTable.Query1]: query1,
}

/** Apollo params for {@link queryPreviewDatabaseTable}. */
interface QueryPreviewDatabaseTableParams extends QueryParams<
    QueryPreviewDatabaseTable,
    QueryPreviewDatabaseTableRequest
> {
    request: QueryPreviewDatabaseTableRequest
}

/** Reads the first rows of one mapped table. Rejects with the back end failure. */
export const queryPreviewDatabaseTable = async ({
    query = QueryPreviewDatabaseTable.Query1,
    request,
    signal,
}: QueryPreviewDatabaseTableParams): Promise<ApolloClient.QueryResult<QueryPreviewDatabaseTableResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
