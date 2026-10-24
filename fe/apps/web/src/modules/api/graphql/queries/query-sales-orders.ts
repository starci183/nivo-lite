import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { SalesOrdersQuery, SalesOrdersQueryVariables } from "../__generated__/graphql"

type QuerySalesOrdersRequest = WireInput<NonNullable<SalesOrdersQueryVariables["input"]>>
type Document = TypedDocumentNode<SalesOrdersQuery, InputVariables<QuerySalesOrdersRequest>>

const query1: Document = gql`
    query SalesOrders($input: ListSalesOrdersInput!) {
        salesOrders(input: $input) {
            nodes {
                id
                workspaceId
                leadId
                orderNo
                items
                amountVnd
                status
                confirmedBy
                confirmedAt
                createdAt
                shippedAt
                carrier
                trackingCode
            }
            pageInfo {
                endCursor
                hasNextPage
            }
        }
    }
`

enum QuerySalesOrders {
    Query1 = "query1",
}

const queryMap: Record<QuerySalesOrders, Document> = {
    [QuerySalesOrders.Query1]: query1,
}

type QuerySalesOrdersParams = QueryParams<QuerySalesOrders, QuerySalesOrdersRequest>

/** Reads one forward page of the selected workspace's sales orders. */
export const querySalesOrders = async ({
    query = QuerySalesOrders.Query1,
    request = {},
    signal,
    headers,
}: QuerySalesOrdersParams = {}) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
        context: { headers },
        fetchPolicy: "no-cache",
    })
}
