import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { LoadCsvImportQuery, LoadCsvImportQueryVariables } from "../__generated__/graphql"

/** The variables of the `loadCsvImport` query. */
type QueryLoadCsvImportRequest = WireInput<LoadCsvImportQueryVariables["input"]>

/** The response of the `loadCsvImport` query: the typed payload straight from the back end contract. */
type QueryLoadCsvImportResponse = LoadCsvImportQuery

const query1: TypedDocumentNode<QueryLoadCsvImportResponse, InputVariables<QueryLoadCsvImportRequest>> = gql`
    query LoadCsvImport($input: LoadCsvImportInput!) {
        loadCsvImport(input: $input) {
            name
            config
            file
            summary
            agentIds
            scheduleMinutes
        }
    }
`

enum QueryLoadCsvImport {
    Query1 = "query1",
}

const queryMap: Record<
    QueryLoadCsvImport,
    TypedDocumentNode<QueryLoadCsvImportResponse, InputVariables<QueryLoadCsvImportRequest>>
> = {
    [QueryLoadCsvImport.Query1]: query1,
}

/** Apollo params for {@link queryLoadCsvImport}. */
interface QueryLoadCsvImportParams extends QueryParams<QueryLoadCsvImport, QueryLoadCsvImportRequest> {
    request: QueryLoadCsvImportRequest
}

/** The saved setup of one import, to upload again into it. Rejects with the back end failure. */
export const queryLoadCsvImport = async ({
    query = QueryLoadCsvImport.Query1,
    request,
    signal,
}: QueryLoadCsvImportParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
