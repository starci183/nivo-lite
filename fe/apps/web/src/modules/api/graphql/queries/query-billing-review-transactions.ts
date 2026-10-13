import { gql, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryBillingReviewTransactionsArgs } from "../__generated__/schema"

type QueryBillingReviewTransactionsRequest = QueryBillingReviewTransactionsArgs["input"]
type QueryBillingReviewTransactionsResponse = Pick<Query, "billingReviewTransactions">

type QueryBillingReviewTransactionsParams = QueryParams<
    QueryBillingReviewTransactions,
    QueryBillingReviewTransactionsRequest
> & { request: QueryBillingReviewTransactionsRequest }

const query1: TypedDocumentNode<
    QueryBillingReviewTransactionsResponse,
    InputVariables<QueryBillingReviewTransactionsRequest>
> = gql`
    query BillingReviewTransactions($input: BillingReviewTransactionsInput!) {
        billingReviewTransactions(input: $input) {
            id
            status
            transferAmount
            receivedAt
            content
        }
    }
`

enum QueryBillingReviewTransactions {
    Query1 = "query1",
}
const queryMap: Record<QueryBillingReviewTransactions, typeof query1> = {
    [QueryBillingReviewTransactions.Query1]: query1,
}

/** Calls the backend billingReviewTransactions query. */
export const queryBillingReviewTransactions = async ({
    query = QueryBillingReviewTransactions.Query1,
    request,
    signal,
}: QueryBillingReviewTransactionsParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
