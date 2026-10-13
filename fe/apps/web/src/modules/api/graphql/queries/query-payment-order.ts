import { gql, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryPaymentOrderArgs } from "../__generated__/schema"

type QueryPaymentOrderRequest = QueryPaymentOrderArgs["input"]
type QueryPaymentOrderResponse = Pick<Query, "paymentOrder">

type QueryPaymentOrderParams = QueryParams<QueryPaymentOrder, QueryPaymentOrderRequest> & {
    request: QueryPaymentOrderRequest
}

const query1: TypedDocumentNode<QueryPaymentOrderResponse, InputVariables<QueryPaymentOrderRequest>> = gql`
    query PaymentOrder($input: PaymentOrderInput!) {
        paymentOrder(input: $input) {
            id
            workspaceId
            planCode
            amountVnd
            orderCode
            status
            expiresAt
            paidAt
            createdAt
            kind
            packCode
            detail {
                credit
                credits
                daysLeft
                from
                fromPrice
                paidUntil
                to
                toPrice
            }
            qrUrl
            bank {
                account
                bank
                holder
            }
        }
    }
`

enum QueryPaymentOrder {
    Query1 = "query1",
}
const queryMap: Record<QueryPaymentOrder, typeof query1> = { [QueryPaymentOrder.Query1]: query1 }

/** Calls the backend paymentOrder query. */
export const queryPaymentOrder = async ({
    query = QueryPaymentOrder.Query1,
    request,
    signal,
}: QueryPaymentOrderParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
