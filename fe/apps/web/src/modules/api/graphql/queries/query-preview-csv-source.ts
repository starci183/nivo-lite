import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { PreviewCsvSourceQuery, PreviewCsvSourceQueryVariables } from "../__generated__/graphql"

/** The variables of the `previewCsvSource` query. */
type QueryPreviewCsvSourceRequest = WireInput<PreviewCsvSourceQueryVariables["input"]>

/** The response of the `previewCsvSource` query: the typed payload straight from the back end contract. */
type QueryPreviewCsvSourceResponse = PreviewCsvSourceQuery

const query1: TypedDocumentNode<QueryPreviewCsvSourceResponse, InputVariables<QueryPreviewCsvSourceRequest>> = gql`
    query PreviewCsvSource($input: PreviewCsvSourceInput!) {
        previewCsvSource(input: $input) {
            headers
            sample
            total
            sheets
            sheet
            delimiter
            mapping
            missing
        }
    }
`

enum QueryPreviewCsvSource {
    Query1 = "query1",
}

const queryMap: Record<
    QueryPreviewCsvSource,
    TypedDocumentNode<QueryPreviewCsvSourceResponse, InputVariables<QueryPreviewCsvSourceRequest>>
> = {
    [QueryPreviewCsvSource.Query1]: query1,
}

/** Apollo params for {@link queryPreviewCsvSource}. */
interface QueryPreviewCsvSourceParams extends QueryParams<QueryPreviewCsvSource, QueryPreviewCsvSourceRequest> {
    request: QueryPreviewCsvSourceRequest
}

/** Reads an import source (file, Google Sheets link, pasted or typed rows) and answers its headers, first rows and a suggested mapping. */
export const queryPreviewCsvSource = async ({
    query = QueryPreviewCsvSource.Query1,
    request,
    signal,
}: QueryPreviewCsvSourceParams): Promise<ApolloClient.QueryResult<QueryPreviewCsvSourceResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
