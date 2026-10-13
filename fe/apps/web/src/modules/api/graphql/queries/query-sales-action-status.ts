import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QuerySalesActionStatusArgs } from "../__generated__/schema"

/** Generated input of the salesActionStatus query. */
type QuerySalesActionStatusRequest = QuerySalesActionStatusArgs["input"]

/** Generated response of the salesActionStatus query. */
type QuerySalesActionStatusResponse = Pick<Query, "salesActionStatus">

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
