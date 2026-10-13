import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { SalesActionStatusQuery, SalesActionStatusQueryVariables } from "../__generated__/graphql"

/** Generated input of the salesActionStatus query. */
type QuerySalesActionStatusRequest = WireInput<SalesActionStatusQueryVariables["input"]>

/** Generated response of the salesActionStatus query. */
type QuerySalesActionStatusResponse = SalesActionStatusQuery

type Document = TypedDocumentNode<QuerySalesActionStatusResponse, InputVariables<QuerySalesActionStatusRequest>>

const query1: Document = gql`
    query SalesActionStatus($input: SalesActionStatusInput!) {
        salesActionStatus(input: $input) {
            errorCode
            id
            status
            workItemId
        }
    }
`

enum QuerySalesActionStatus {
    Query1 = "query1",
}

const queryMap: Record<QuerySalesActionStatus, Document> = {
    [QuerySalesActionStatus.Query1]: query1,
}

/** Apollo parameters for the salesActionStatus query. */
type QuerySalesActionStatusParams = QueryParams<QuerySalesActionStatus, QuerySalesActionStatusRequest> & {
    request: QuerySalesActionStatusRequest
}

/** Runs the workspace-scoped salesActionStatus query through the authenticated GraphQL client. */
export const querySalesActionStatus = async ({
    query = QuerySalesActionStatus.Query1,
    request,
    signal,
    headers,
}: QuerySalesActionStatusParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
        variables: { input: request },
    })
}
