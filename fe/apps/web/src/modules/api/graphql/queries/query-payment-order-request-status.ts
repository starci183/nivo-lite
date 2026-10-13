import { gql, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryPaymentOrderRequestStatusArgs } from "../__generated__/schema"

type QueryPaymentOrderRequestStatusRequest = QueryPaymentOrderRequestStatusArgs["input"]
type QueryPaymentOrderRequestStatusResponse = Pick<Query, "paymentOrderRequestStatus">

type QueryPaymentOrderRequestStatusParams = QueryParams<
    QueryPaymentOrderRequestStatus,
    QueryPaymentOrderRequestStatusRequest
> & { request: QueryPaymentOrderRequestStatusRequest }

const query1: TypedDocumentNode<
    QueryPaymentOrderRequestStatusResponse,
    InputVariables<QueryPaymentOrderRequestStatusRequest>
> = gql`
    query PaymentOrderRequestStatus($input: PaymentOrderRequestStatusInput!) {
        paymentOrderRequestStatus(input: $input) {
            id
            status
            resultId
            errorCode
        }
    }
`

enum QueryPaymentOrderRequestStatus {
    Query1 = "query1",
}
const queryMap: Record<QueryPaymentOrderRequestStatus, typeof query1> = {
    [QueryPaymentOrderRequestStatus.Query1]: query1,
}

/** Calls the backend paymentOrderRequestStatus query. */
export const queryPaymentOrderRequestStatus = async ({
    query = QueryPaymentOrderRequestStatus.Query1,
    request,
    signal,
}: QueryPaymentOrderRequestStatusParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
