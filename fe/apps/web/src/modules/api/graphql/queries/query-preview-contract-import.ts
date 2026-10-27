import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { PreviewContractImportQuery, PreviewContractImportQueryVariables } from "../__generated__/graphql"

/** The variables of the `previewContractImport` query. */
export type QueryPreviewContractImportRequest = WireInput<PreviewContractImportQueryVariables["input"]>

/** The response of the `previewContractImport` query: the typed payload straight from the back end contract. */
type QueryPreviewContractImportResponse = PreviewContractImportQuery

/** What reading a contract sheet answers: headers, the mapping, the first rows judged and the counts. */
export type ContractImportPreview = QueryPreviewContractImportResponse["previewContractImport"]

type Document = TypedDocumentNode<QueryPreviewContractImportResponse, InputVariables<QueryPreviewContractImportRequest>>

const query1: Document = gql`
    query PreviewContractImport($input: PreviewContractImportInput!) {
        previewContractImport(input: $input) {
            headers
            sheets
            sheet
            total
            ready
            mapping {
                customerName
                plan
                startsOn
                endsOn
                amountVnd
                status
                note
            }
            rows {
                row
                customerName
                plan
                startsOn
                endsOn
                amountVnd
                status
                note
                problems
            }
        }
    }
`

enum QueryPreviewContractImport {
    Query1 = "query1",
}

const queryMap: Record<QueryPreviewContractImport, Document> = {
    [QueryPreviewContractImport.Query1]: query1,
}

/** Apollo params for {@link queryPreviewContractImport}. */
interface QueryPreviewContractImportParams extends QueryParams<
    QueryPreviewContractImport,
    QueryPreviewContractImportRequest
> {
    request: QueryPreviewContractImportRequest
}

/** Reads a contract sheet (an uploaded .csv/.xlsx or pasted text) and answers its headers, a suggested mapping and the first rows with their problems. */
export const queryPreviewContractImport = async ({
    query = QueryPreviewContractImport.Query1,
    request,
    signal,
}: QueryPreviewContractImportParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
